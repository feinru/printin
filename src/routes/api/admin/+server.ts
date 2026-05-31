// src/routes/api/admin/+server.ts — Admin API (jobs list + stats)
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listJobs, getStats, updateJobStatus, getJob } from '$lib/server/db';
import { cancelPrintJob } from '$lib/server/print';

function checkAuth(request: Request): void {
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';
  const auth = request.headers.get('x-admin-password');
  if (auth !== adminPassword) error(401, 'Unauthorized');
}

export const GET: RequestHandler = async ({ request, url }) => {
  checkAuth(request);

  const action = url.searchParams.get('action') ?? 'jobs';

  if (action === 'stats') {
    return json(getStats());
  }

  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
  return json({ jobs: listJobs(limit, offset) });
};

export const POST: RequestHandler = async ({ request }) => {
  checkAuth(request);

  const body = await request.json() as { action: string; job_id: string };

  if (body.action === 'cancel') {
    const job = getJob(body.job_id);
    if (!job) error(404, 'Job not found');
    if (job.cups_job_id) await cancelPrintJob(job.cups_job_id);
    updateJobStatus(body.job_id, 'cancelled');
    return json({ success: true });
  }

  error(400, 'Unknown action');
};
