// src/routes/api/payment/webhook/+server.ts — POST Midtrans status notifications
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updatePaymentStatus, updateJobStatus, getJob } from '$lib/server/db';
import { submitPrintJob } from '$lib/server/print';
import { broadcast } from '$lib/server/ws';
import crypto from 'crypto';

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;

export const POST: RequestHandler = async ({ request }) => {
  if (!MIDTRANS_SERVER_KEY) {
    console.error('[Webhook] Received webhook, but MIDTRANS_SERVER_KEY is not configured.');
    error(500, 'Webhook receiver not configured');
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    error(400, 'Invalid JSON body');
  }

  const { signature_key, order_id, status_code, gross_amount, transaction_status, transaction_id } = body;

  if (!signature_key || !order_id || !status_code || !gross_amount || !transaction_status) {
    error(400, 'Missing required Midtrans webhook parameters');
  }

  // 1. Verify Midtrans signature key for security
  // Formula: SHA512(order_id + status_code + gross_amount + ServerKey)
  const computedHash = crypto.createHash('sha512')
    .update(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY)
    .digest('hex');

  if (computedHash !== signature_key) {
    console.warn(`[Webhook] Signature verification FAILED for order ${order_id}. Computed: ${computedHash}, Received: ${signature_key}`);
    error(403, 'Invalid signature key');
  }

  console.log(`[Webhook] Signature verified. Order: ${order_id}, Status: ${transaction_status}`);

  // 2. Handle transaction status
  // Midtrans successful statuses: 'settlement' (instant pay) or 'capture' (card auth & capture)
  if (transaction_status === 'settlement' || transaction_status === 'capture') {
    console.log(`[Webhook] Payment settled for order: ${order_id}. Transaction ID: ${transaction_id}`);

    // Update payment
    updatePaymentStatus(order_id, 'confirmed', transaction_id);
    broadcast({ type: 'payment_status', payment_id: order_id, status: 'confirmed' });

    // Fetch and submit associated print job
    const job = getJob(order_id); // Payment ID matches Job ID in PrintMate
    if (job) {
      if (job.status === 'pending') {
        console.log(`[Webhook] Advancing job ${job.id} status to queued`);
        updateJobStatus(job.id, 'queued');
        broadcast({ type: 'job_status', job_id: job.id, status: 'queued' });

        // Submit the print job to physical/mock queue
        try {
          console.log(`[Webhook] Submitting job ${job.id} to printing service`);
          await submitPrintJob(job);
        } catch (err) {
          console.error(`[Webhook] Failed to submit print job ${job.id}:`, err);
        }
      } else {
        console.log(`[Webhook] Job ${job.id} is already in status: ${job.status}`);
      }
    } else {
      console.warn(`[Webhook] Settled payment for order ${order_id}, but no matching Job was found.`);
    }
  } else if (transaction_status === 'deny' || transaction_status === 'cancel' || transaction_status === 'expire') {
    console.log(`[Webhook] Payment failed or expired for order: ${order_id}. Status: ${transaction_status}`);
    updatePaymentStatus(order_id, 'failed');
    broadcast({ type: 'payment_status', payment_id: order_id, status: 'failed' });

    const job = getJob(order_id);
    if (job) {
      updateJobStatus(job.id, 'cancelled');
      broadcast({ type: 'job_status', job_id: job.id, status: 'cancelled' });
    }
  }

  return json({ success: true });
};
