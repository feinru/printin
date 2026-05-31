// src/routes/api/upload/+server.ts — POST /api/upload
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSession, createJob, getConfig, touchSession, getSession } from '$lib/server/db';
import { saveUpload, getPdfPageCount, sanitizeFilename } from '$lib/server/storage';
import { randomUUID } from 'crypto';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const config = getConfig();

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) error(400, 'No file provided');
  if (file.type !== 'application/pdf') error(400, 'Only PDF files are supported');
  if (file.size > config.max_file_size_mb * 1024 * 1024) {
    error(413, `File too large. Maximum size is ${config.max_file_size_mb}MB`);
  }

  // Session management
  let sessionId = cookies.get('session_id');
  if (sessionId) {
    const existing = getSession(sessionId);
    if (!existing || existing.expires_at < Date.now()) {
      sessionId = undefined;
    }
  }
  if (!sessionId) {
    sessionId = randomUUID();
    createSession(sessionId);
    cookies.set('session_id', sessionId, {
      path: '/',
      maxAge: 3600,
      httpOnly: true,
      sameSite: 'lax'
    });
  } else {
    touchSession(sessionId);
  }

  // Save file
  const safeFilename = `${randomUUID()}_${sanitizeFilename(file.name)}`;
  const buffer = await file.arrayBuffer();
  const filePath = await saveUpload(safeFilename, buffer);

  // Extract page count
  const pageCount = await getPdfPageCount(filePath);

  // Create job record
  const jobId = randomUUID();
  createJob(jobId, sessionId, filePath, file.name, pageCount);

  return json({
    job_id: jobId,
    file_name: file.name,
    page_count: pageCount
  });
};
