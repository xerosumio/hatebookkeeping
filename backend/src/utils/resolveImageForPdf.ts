import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { FileUpload } from '../models/FileUpload.js';

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/**
 * Resolves an upload URL (e.g. `/api/uploads/<id>` or `/api/uploads/<filename>`)
 * into a value that @react-pdf/renderer's <Image src> can consume:
 *   - base64 data URI for MongoDB-stored files
 *   - absolute filesystem path for legacy disk-stored files
 *   - empty string if the image cannot be found
 */
export async function resolveImageForPdf(url: string): Promise<string> {
  if (!url) return '';

  const stripped = url.replace(/^\/api\/uploads\//, '');

  if (mongoose.Types.ObjectId.isValid(stripped)) {
    const doc = await FileUpload.findById(stripped);
    if (doc && doc.data && doc.size > 0) {
      const b64 = doc.data.toString('base64');
      return `data:${doc.contentType};base64,${b64}`;
    }
  }

  const abs = path.resolve(env.uploadDir, stripped);
  if (fs.existsSync(abs) && fs.statSync(abs).size > 0) {
    return abs;
  }

  return '';
}

/**
 * Resolves multiple image fields on an object in-place.
 */
export async function resolveImageFields<T extends Record<string, any>>(
  obj: T,
  fields: readonly (keyof T & string)[],
): Promise<void> {
  for (const field of fields) {
    if (obj[field] && typeof obj[field] === 'string') {
      (obj as any)[field] = await resolveImageForPdf(obj[field] as string);
    }
  }
}
