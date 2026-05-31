// src/routes/api/jobs/[id]/+server.ts — GET/PATCH /api/jobs/:id
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getJob, updateJobOptions } from '$lib/server/db';
import { calculatePrice } from '$lib/server/pricing';
import type { PrintOptions } from '$lib/types';

export const GET: RequestHandler = async ({ params }) => {
  const job = getJob(params.id);
  if (!job) error(404, 'Job not found');
  return json(job);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const job = getJob(params.id);
  if (!job) error(404, 'Job not found');
  if (job.status !== 'pending') error(400, 'Cannot modify job that is already processing');

  const body = await request.json() as Partial<PrintOptions>;

  const newOptions: PrintOptions = {
    copies: body.copies ?? job.options.copies,
    color: body.color ?? job.options.color,
    duplex: body.duplex ?? job.options.duplex,
    paper: body.paper ?? job.options.paper,
    pageFrom: body.pageFrom ?? job.options.pageFrom,
    pageTo: body.pageTo ?? job.options.pageTo
  };

  // Validate
  if (newOptions.copies < 1 || newOptions.copies > 99) error(400, 'copies must be 1–99');
  if (newOptions.pageFrom < 1 || newOptions.pageFrom > job.page_count) error(400, 'Invalid pageFrom');
  if (newOptions.pageTo < newOptions.pageFrom || newOptions.pageTo > job.page_count) error(400, 'Invalid pageTo');

  const breakdown = calculatePrice(newOptions, job.page_count);
  updateJobOptions(params.id, newOptions, breakdown.total);

  return json({ options: newOptions, price: breakdown.total, breakdown });
};
