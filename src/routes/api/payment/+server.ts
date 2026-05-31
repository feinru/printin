// src/routes/api/payment/+server.ts — POST /api/payment (create QRIS payment)
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getJob, createPayment } from '$lib/server/db';
import { generateQrisQr, scheduleAutoConfirm } from '$lib/server/payment';
import { randomUUID } from 'crypto';

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json() as { job_id: string };
  if (!body.job_id) error(400, 'job_id required');

  const job = getJob(body.job_id);
  if (!job) error(404, 'Job not found');
  if (job.status !== 'pending') error(400, 'Job is not in a payable state');
  if (job.price <= 0) error(400, 'Job has no price set — configure options first');

  const paymentId = randomUUID();
  const qrData = await generateQrisQr(paymentId, job.price);
  const payment = createPayment(paymentId, job.id, job.price, qrData);

  // In demo mode, auto-confirm after delay
  scheduleAutoConfirm(payment);

  return json({
    payment_id: paymentId,
    amount: job.price,
    qr_data: qrData,
    status: 'pending'
  });
};
