// src/lib/server/payment.ts — QRIS payment adapter (Midtrans Core API + Sandbox with Mock fallback)
import QRCode from 'qrcode';
import { updatePaymentStatus, updateJobStatus } from './db';
import { broadcast } from './ws';
import type { Payment } from '$lib/types';

import { env } from '$env/dynamic/private';

const MIDTRANS_SERVER_KEY = env.MIDTRANS_SERVER_KEY;
const MIDTRANS_API_URL = 'https://api.sandbox.midtrans.com/v2/charge';
const MOCK_CONFIRM_DELAY_MS = parseInt(env.MOCK_CONFIRM_DELAY_MS ?? '8000', 10);

export function isMidtransConfigured(): boolean {
  return !!MIDTRANS_SERVER_KEY;
}

/**
 * Generate a QRIS QR code data URL for the given payment.
 * If Midtrans is configured, creates a dynamic GoPay/QRIS charge via Midtrans API.
 * Otherwise, falls back to a simulated offline QRIS string.
 */
export async function generateQrisQr(payment_id: string, amount: number): Promise<string> {
  if (MIDTRANS_SERVER_KEY) {
    console.log(`[Payment] Initiating Midtrans Sandbox charge for payment ${payment_id} (Rp${amount})`);
    
    // Auth header is Basic Auth with ServerKey base64 encoded (no password)
    const authHeader = 'Basic ' + Buffer.from(MIDTRANS_SERVER_KEY + ':').toString('base64');
    
    const response = await fetch(MIDTRANS_API_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        payment_type: 'gopay', // GOPAY type yields a dynamic QRIS QR code automatically
        transaction_details: {
          order_id: payment_id,
          gross_amount: Math.round(amount)
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Payment] Midtrans Core API error:`, errText);
      throw new Error(`Midtrans API failed with status ${response.status}: ${errText}`);
    }

    const result = await response.json();
    const qrAction = result.actions?.find((a: any) => a.name === 'generate-qr-code');
    if (!qrAction) {
      console.error('[Payment] generate-qr-code action not found in Midtrans response:', result);
      throw new Error('QR code generation payload missing from Midtrans response');
    }

    // Convert Midtrans QRIS string to a clean canvas QR
    return await QRCode.toDataURL(qrAction.url, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
      color: { dark: '#000000', light: '#ffffff' }
    });
  }

  // Fallback Mock Mode:
  console.log(`[Payment] MIDTRANS_SERVER_KEY not set. Running in MOCK QRIS mode.`);
  const mockQrisString = [
    '000201',
    '010212',                         // dynamic QR
    '2653',                           // merchant account info
    `0014ID.CO.DEMO.WWW`,
    `0118936009140000${payment_id.slice(0, 8)}`,
    '52044829',                       // MCC: misc retail
    '5303360',                        // currency: IDR (360)
    `54${String(amount).length.toString().padStart(2, '0')}${amount}`,
    '5802ID',
    '5907PrintIn',
    '6013YOGYAKARTA ID',
    `62${(payment_id.length + 4).toString().padStart(2, '0')}0210${payment_id}`,
    '6304ABCD'                        // fake CRC
  ].join('');

  return await QRCode.toDataURL(mockQrisString, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 300,
    color: { dark: '#000000', light: '#ffffff' }
  });
}

/**
 * After payment is created, schedule mock auto-confirmation.
 * If Midtrans is configured, this is a no-op since Midtrans calls /api/payment/webhook.
 */
export function scheduleAutoConfirm(payment: Payment): void {
  if (MIDTRANS_SERVER_KEY) {
    console.log(`[Payment] Midtrans active. Webhook notification expected for payment: ${payment.id}`);
    return;
  }

  setTimeout(() => {
    const ref = `MOCK-${Date.now()}`;
    updatePaymentStatus(payment.id, 'confirmed', ref);
    broadcast({ type: 'payment_status', payment_id: payment.id, status: 'confirmed' });

    // Also advance job to allow printing
    updateJobStatus(payment.job_id, 'queued');
    broadcast({ type: 'job_status', job_id: payment.job_id, status: 'queued' });
  }, MOCK_CONFIRM_DELAY_MS);
}
