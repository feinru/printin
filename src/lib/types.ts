// src/lib/types.ts — shared TypeScript types

export type SessionState = 'upload' | 'options' | 'preview' | 'payment' | 'printing' | 'done' | 'expired';

export type JobStatus = 'pending' | 'queued' | 'printing' | 'done' | 'error' | 'cancelled';

export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'refunded';

export type PaperSize = 'A4' | 'A3' | 'Letter' | 'Legal';

export type ColorMode = 'bw' | 'color';

export type DuplexMode = 'simplex' | 'duplex';

export interface PrintOptions {
  copies: number;
  color: ColorMode;
  duplex: DuplexMode;
  paper: PaperSize;
  pageFrom: number;
  pageTo: number;
}

export interface Session {
  id: string;
  created_at: number;
  expires_at: number;
  state: SessionState;
}

export interface Job {
  id: string;
  session_id: string;
  file_path: string;
  file_name: string;
  page_count: number;
  options: PrintOptions;
  price: number;       // IDR
  cups_job_id: string | null;
  status: JobStatus;
  created_at: number;
  completed_at: number | null;
}

export interface Payment {
  id: string;
  job_id: string;
  method: 'qris';
  amount: number;      // IDR
  status: PaymentStatus;
  qr_data: string | null;
  ref: string | null;
  created_at: number;
  confirmed_at: number | null;
}

export interface PriceBreakdown {
  base_per_page: number;
  page_count: number;
  effective_pages: number;
  copies: number;
  color_surcharge: number;
  duplex_discount: number;
  subtotal: number;
  total: number;
}

export interface ConfigMap {
  price_bw_per_page: number;
  price_color_per_page: number;
  duplex_discount_pct: number;
  max_file_size_mb: number;
  session_timeout_sec: number;
  printer_name: string;
}

// WebSocket message types
export type WsMessage =
  | { type: 'payment_status'; payment_id: string; status: PaymentStatus }
  | { type: 'job_status'; job_id: string; status: JobStatus; cups_job_id?: string }
  | { type: 'ping' };
