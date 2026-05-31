// src/lib/server/print.ts — Mock printer state machine
// In demo mode (IS_MOCK = true), simulates the print job lifecycle without CUPS.
// Real mode uses child_process.spawn to call lp/lpstat — works on Node and Bun.

import { updateJobStatus } from './db';
import { broadcast } from './ws';
import type { Job } from '$lib/types';
import { spawn } from 'child_process';

const IS_MOCK = true; // Always mock in demo. Set to false + configure PRINTER_NAME for real CUPS.

export interface PrintResult {
  success: boolean;
  cups_job_id: string;
  error?: string;
}

/**
 * Submit a job to the printer.
 * Mock: assigns a fake job ID and schedules status transitions.
 * Real: calls `lp -d <printer> ...` and parses the job ID.
 */
export async function submitPrintJob(job: Job): Promise<PrintResult> {
  if (IS_MOCK) return submitMock(job);
  return submitReal(job);
}

// ─── Mock implementation ───────────────────────────────────────────────────────

function submitMock(job: Job): PrintResult {
  const fakeJobId = `mock-${Date.now()}`;

  const delays: Array<[number, 'queued' | 'printing' | 'done']> = [
    [500,  'queued'],
    [2500, 'printing'],
    [5500, 'done']
  ];

  for (const [delay, status] of delays) {
    setTimeout(() => {
      updateJobStatus(job.id, status, fakeJobId);
      broadcast({ type: 'job_status', job_id: job.id, status, cups_job_id: fakeJobId });
    }, delay);
  }

  return { success: true, cups_job_id: fakeJobId };
}

// ─── Real CUPS implementation (child_process, Node+Bun compat) ────────────────

function spawnAsync(cmd: string, args: string[]): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.on('close', (code) => resolve({ stdout, code: code ?? 0 }));
    proc.on('error', reject);
  });
}

async function submitReal(job: Job): Promise<PrintResult> {
  const printerName = process.env.PRINTER_NAME ?? 'default';
  const { options, file_path } = job;

  const args = [
    '-d', printerName,
    '-n', String(options.copies),
    '-o', `sides=${options.duplex === 'duplex' ? 'two-sided-long-edge' : 'one-sided'}`,
    '-o', `ColorModel=${options.color === 'color' ? 'RGB' : 'Gray'}`,
    '-o', `media=${options.paper}`,
    '-o', `page-ranges=${options.pageFrom}-${options.pageTo}`,
    file_path
  ];

  try {
    const { stdout, code } = await spawnAsync('lp', args);
    if (code !== 0) throw new Error(`lp exited with code ${code}`);

    const match = stdout.match(/request id is (\S+)/);
    if (!match) throw new Error(`lp returned unexpected output: ${stdout}`);

    const cups_job_id = match[1];
    pollCupsStatus(job.id, cups_job_id);
    return { success: true, cups_job_id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, cups_job_id: '', error: msg };
  }
}

function pollCupsStatus(job_id: string, cups_job_id: string) {
  const interval = setInterval(async () => {
    try {
      const { stdout } = await spawnAsync('lpstat', ['-l', '-j', cups_job_id]);

      let status: 'queued' | 'printing' | 'done' | 'error' = 'queued';
      if (stdout.includes('completed'))        status = 'done';
      else if (stdout.includes('processing'))  status = 'printing';
      else if (stdout.includes('aborted') || stdout.includes('stopped')) status = 'error';

      updateJobStatus(job_id, status, cups_job_id);
      broadcast({ type: 'job_status', job_id, status });

      if (status === 'done' || status === 'error') clearInterval(interval);
    } catch {
      clearInterval(interval);
    }
  }, 2000);
}

export async function cancelPrintJob(cups_job_id: string): Promise<boolean> {
  if (IS_MOCK) return true;
  try {
    const { code } = await spawnAsync('cancel', [cups_job_id]);
    return code === 0;
  } catch {
    return false;
  }
}
