// src/routes/api/print/+server.ts — POST /api/print (submit job to printer)
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getJob, getPaymentByJob, updateJobStatus } from '$lib/server/db';
import { submitPrintJob } from '$lib/server/print';

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json() as { job_id: string };
  if (!body.job_id) error(400, 'job_id required');

  const job = getJob(body.job_id);
  if (!job) error(404, 'Job not found');

  // Verify payment is confirmed
  const payment = getPaymentByJob(job.id);
  if (!payment || payment.status !== 'confirmed') {
    error(402, 'Payment not confirmed');
  }

  if (job.status !== 'pending' && job.status !== 'queued') {
    error(400, `Job is already ${job.status}`);
  }

  const result = await submitPrintJob(job);
  if (!result.success) {
    updateJobStatus(job.id, 'error');
    error(500, result.error ?? 'Print submission failed');
  }

  updateJobStatus(job.id, 'queued', result.cups_job_id);

  return json({ success: true, cups_job_id: result.cups_job_id });
};
