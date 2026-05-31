// src/routes/api/file/[jobId]/+server.ts — Serve uploaded PDF file
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getJob } from '$lib/server/db';
import { createReadStream, existsSync } from 'fs';

export const GET: RequestHandler = async ({ params }) => {
  const job = getJob(params.jobId);
  if (!job) error(404, 'Job not found');
  if (!existsSync(job.file_path)) error(404, 'File not found on disk');

  // Stream via Node ReadableStream for Node/Bun compat
  const nodeStream = createReadStream(job.file_path);
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on('data', chunk => controller.enqueue(chunk));
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', err => controller.error(err));
    },
    cancel() { nodeStream.destroy(); }
  });

  return new Response(webStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${encodeURIComponent(job.file_name)}"`,
      'Cache-Control': 'private, no-store'
    }
  });
};
