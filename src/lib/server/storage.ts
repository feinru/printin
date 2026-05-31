// src/lib/server/storage.ts — file upload and path management
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? 'data/uploads';

// Ensure upload directory exists on module load
mkdirSync(UPLOAD_DIR, { recursive: true });

export function getUploadDir(): string {
  return UPLOAD_DIR;
}

export function getFilePath(filename: string): string {
  return join(UPLOAD_DIR, filename);
}

export async function saveUpload(filename: string, data: ArrayBuffer): Promise<string> {
  const path = getFilePath(filename);
  writeFileSync(path, Buffer.from(data));
  return path;
}

/**
 * Extract PDF page count by reading the page count from the PDF binary.
 * Uses a simple regex on the raw bytes — works for well-formed PDFs.
 * Falls back to 1 if detection fails.
 */
export async function getPdfPageCount(filePath: string): Promise<number> {
  try {
    const { readFileSync } = await import('fs');
    const buffer = readFileSync(filePath);
    const text = buffer.toString('latin1');

    // Try /Count from PDF page tree
    const match = text.match(/\/Count\s+(\d+)/);
    if (match) return parseInt(match[1], 10);

    // Fallback: count /Page objects (less accurate)
    const pages = text.match(/\/Type\s*\/Page[^s]/g);
    if (pages) return pages.length;

    return 1;
  } catch {
    return 1;
  }
}

export function sanitizeFilename(original: string): string {
  // Keep extension, replace everything else with safe chars
  const ext = original.slice(original.lastIndexOf('.')).toLowerCase();
  const base = original.slice(0, original.lastIndexOf('.')).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${base}${ext}`;
}
