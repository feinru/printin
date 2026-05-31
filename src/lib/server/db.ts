// src/lib/server/db.ts — SQLite database setup via better-sqlite3
// better-sqlite3 works in both Node.js (Vite dev) and Bun (production)
import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Session, Job, Payment, PrintOptions, ConfigMap, JobStatus, PaymentStatus, SessionState } from '$lib/types';

const DB_PATH = process.env.DB_PATH ?? 'data/printer.db';

// Ensure data directory exists
mkdirSync('data', { recursive: true });

export const db = new Database(DB_PATH);

// WAL mode for better concurrent read perf
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Auto-migrate on startup
function migrate() {
  const migrationPath = join(process.cwd(), 'migrations', '001_init.sql');
  const sql = readFileSync(migrationPath, 'utf-8');
  db.exec(sql);
}

migrate();

// ─── Config ───────────────────────────────────────────────────────────────────

export function getConfig(): ConfigMap {
  const rows = db.prepare('SELECT key, value FROM config').all() as { key: string; value: string }[];
  const map: Record<string, unknown> = {};
  for (const row of rows) {
    map[row.key] = JSON.parse(row.value);
  }
  return map as unknown as ConfigMap;
}

export function setConfig(key: keyof ConfigMap, value: unknown): void {
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function createSession(id: string): Session {
  const now = Date.now();
  const config = getConfig();
  const expires_at = now + config.session_timeout_sec * 1000;
  db.prepare('INSERT INTO sessions (id, created_at, expires_at, state) VALUES (?, ?, ?, ?)').run(id, now, expires_at, 'upload');
  return { id, created_at: now, expires_at, state: 'upload' };
}

export function getSession(id: string): Session | null {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | null;
}

export function updateSessionState(id: string, state: SessionState): void {
  db.prepare('UPDATE sessions SET state = ? WHERE id = ?').run(state, id);
}

export function touchSession(id: string): void {
  const config = getConfig();
  const expires_at = Date.now() + config.session_timeout_sec * 1000;
  db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(expires_at, id);
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export function createJob(
  id: string,
  session_id: string,
  file_path: string,
  file_name: string,
  page_count: number
): Job {
  const now = Date.now();
  const defaultOptions: PrintOptions = {
    copies: 1, color: 'bw', duplex: 'simplex',
    paper: 'A4', pageFrom: 1, pageTo: page_count
  };
  db.prepare(
    `INSERT INTO jobs (id, session_id, file_path, file_name, page_count, options, price, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 'pending', ?)`
  ).run(id, session_id, file_path, file_name, page_count, JSON.stringify(defaultOptions), now);
  return {
    id, session_id, file_path, file_name, page_count,
    options: defaultOptions, price: 0,
    cups_job_id: null, status: 'pending',
    created_at: now, completed_at: null
  };
}

export function getJob(id: string): Job | null {
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as (Omit<Job, 'options'> & { options: string }) | undefined;
  if (!row) return null;
  return { ...row, options: JSON.parse(row.options) as PrintOptions };
}

export function updateJobOptions(id: string, options: PrintOptions, price: number): void {
  db.prepare('UPDATE jobs SET options = ?, price = ? WHERE id = ?').run(JSON.stringify(options), price, id);
}

export function updateJobStatus(id: string, status: JobStatus, cups_job_id?: string): void {
  if (cups_job_id) {
    db.prepare('UPDATE jobs SET status = ?, cups_job_id = ? WHERE id = ?').run(status, cups_job_id, id);
  } else {
    db.prepare('UPDATE jobs SET status = ? WHERE id = ?').run(status, id);
  }
  if (status === 'done' || status === 'error' || status === 'cancelled') {
    db.prepare('UPDATE jobs SET completed_at = ? WHERE id = ?').run(Date.now(), id);
  }
}

export function listJobs(limit = 50, offset = 0): Job[] {
  const rows = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset) as (Omit<Job, 'options'> & { options: string })[];
  return rows.map(r => ({ ...r, options: JSON.parse(r.options) as PrintOptions }));
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export function createPayment(id: string, job_id: string, amount: number, qr_data: string): Payment {
  const now = Date.now();
  db.prepare(
    `INSERT INTO payments (id, job_id, method, amount, status, qr_data, created_at)
     VALUES (?, ?, 'qris', ?, 'pending', ?, ?)`
  ).run(id, job_id, amount, qr_data, now);
  return {
    id, job_id, method: 'qris', amount, status: 'pending',
    qr_data, ref: null, created_at: now, confirmed_at: null
  };
}

export function getPayment(id: string): Payment | null {
  return db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as Payment | null;
}

export function getPaymentByJob(job_id: string): Payment | null {
  return db.prepare('SELECT * FROM payments WHERE job_id = ? ORDER BY created_at DESC LIMIT 1').get(job_id) as Payment | null;
}

export function updatePaymentStatus(id: string, status: PaymentStatus, ref?: string): void {
  if (ref) {
    db.prepare('UPDATE payments SET status = ?, ref = ? WHERE id = ?').run(status, ref, id);
  } else {
    db.prepare('UPDATE payments SET status = ? WHERE id = ?').run(status, id);
  }
  if (status === 'confirmed') {
    db.prepare('UPDATE payments SET confirmed_at = ? WHERE id = ?').run(Date.now(), id);
  }
}

// ─── Admin Stats ──────────────────────────────────────────────────────────────

export function getStats(): { total_jobs: number; completed_jobs: number; total_revenue: number } {
  const result = db.prepare(`
    SELECT
      COUNT(*) as total_jobs,
      SUM(CASE WHEN j.status = 'done' THEN 1 ELSE 0 END) as completed_jobs,
      COALESCE(SUM(CASE WHEN p.status = 'confirmed' THEN p.amount ELSE 0 END), 0) as total_revenue
    FROM jobs j
    LEFT JOIN payments p ON p.job_id = j.id
  `).get() as { total_jobs: number; completed_jobs: number; total_revenue: number } | undefined;
  return result ?? { total_jobs: 0, completed_jobs: 0, total_revenue: 0 };
}
