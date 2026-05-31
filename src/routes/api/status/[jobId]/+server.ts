// src/routes/api/status/[jobId]/+server.ts — SSE job status stream
import type { RequestHandler } from './$types';
import { getJob } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {
  const job = getJob(params.jobId);
  if (!job) error(404, 'Job not found');

  let interval: Timer;
  let timeout: Timer;
  let active = true;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        if (!active) return;
        try {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          active = false;
        }
      };

      send({ status: job.status });

      if (job.status === 'done' || job.status === 'error' || job.status === 'cancelled') {
        try { controller.close(); } catch {}
        active = false;
        return;
      }

      interval = setInterval(() => {
        const current = getJob(params.jobId);
        if (!current) {
          clearInterval(interval);
          if (active) {
            try { controller.close(); } catch {}
            active = false;
          }
          return;
        }
        send({ status: current.status });
        if (current.status === 'done' || current.status === 'error' || current.status === 'cancelled') {
          clearInterval(interval);
          if (active) {
            try { controller.close(); } catch {}
            active = false;
          }
        }
      }, 1000);

      timeout = setTimeout(() => {
        clearInterval(interval);
        if (active) {
          try { controller.close(); } catch {}
          active = false;
        }
      }, 300_000);
    },
    cancel() {
      active = false;
      clearInterval(interval);
      clearTimeout(timeout);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
};

