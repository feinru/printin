// src/routes/api/payment/[id]/info/+server.ts — GET payment info (for QR retrieval)
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPayment } from '$lib/server/db';

export const GET: RequestHandler = async ({ params }) => {
  const payment = getPayment(params.id);
  if (!payment) error(404, 'Payment not found');
  return json({ qr_data: payment.qr_data, status: payment.status, amount: payment.amount });
};
