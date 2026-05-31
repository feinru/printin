// src/routes/api/payment/[id]/poll/+server.ts — GET SSE payment status poll
import type { RequestHandler } from './$types';
import { getPayment } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {
  const payment = getPayment(params.id);
  if (!payment) error(404, 'Payment not found');

  // Server-Sent Events stream
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

      send({ status: payment.status });

      if (payment.status !== 'pending') {
        try { controller.close(); } catch {}
        active = false;
        return;
      }

      // Poll DB every 1s
      interval = setInterval(() => {
        const current = getPayment(params.id);
        if (!current) {
          clearInterval(interval);
          if (active) {
            try { controller.close(); } catch {}
            active = false;
          }
          return;
        }
        send({ status: current.status });
        if (current.status !== 'pending') {
          clearInterval(interval);
          if (active) {
            try { controller.close(); } catch {}
            active = false;
          }
        }
      }, 1000);

      // Cleanup after 5 minutes max
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
