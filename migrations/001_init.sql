-- Printer Vending Machine — Initial Schema

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  state       TEXT NOT NULL DEFAULT 'upload'
  -- state: 'upload' | 'options' | 'preview' | 'payment' | 'printing' | 'done' | 'expired'
);

CREATE TABLE IF NOT EXISTS jobs (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES sessions(id),
  file_path    TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  page_count   INTEGER NOT NULL DEFAULT 0,
  options      TEXT NOT NULL DEFAULT '{}',
  -- options JSON: { copies, color, duplex, paper, pageRange }
  price        INTEGER NOT NULL DEFAULT 0, -- IDR in rupiah (not cents)
  cups_job_id  TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  -- status: 'pending' | 'queued' | 'printing' | 'done' | 'error' | 'cancelled'
  created_at   INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS payments (
  id         TEXT PRIMARY KEY,
  job_id     TEXT NOT NULL REFERENCES jobs(id),
  method     TEXT NOT NULL DEFAULT 'qris',
  amount     INTEGER NOT NULL,  -- IDR
  status     TEXT NOT NULL DEFAULT 'pending',
  -- status: 'pending' | 'confirmed' | 'failed' | 'refunded'
  qr_data    TEXT,              -- QRIS string / data URL
  ref        TEXT,              -- gateway transaction ref
  created_at INTEGER NOT NULL,
  confirmed_at INTEGER
);

CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL  -- JSON value
);

-- Default pricing config (IDR)
INSERT OR IGNORE INTO config (key, value) VALUES
  ('price_bw_per_page',    '500'),
  ('price_color_per_page', '2000'),
  ('duplex_discount_pct',  '10'),
  ('max_file_size_mb',     '20'),
  ('session_timeout_sec',  '90'),
  ('printer_name',         '"PRINTER_MOCK"');
