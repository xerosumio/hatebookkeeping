import { can, type FileDto } from '@hbk/shared';
import { validationError } from '../../platform/errors.js';
import type { UserDoc } from '../users/model.js';
import { FileUpload, type FileDoc, type FilePurpose } from './model.js';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const startsWith = (data: Buffer, bytes: number[], offset = 0) => bytes.every((byte, index) => data[offset + index] === byte);

/** Decides the type from the file's own first bytes, never from what the browser claimed. */
export function sniffContentType(data: Buffer): string | null {
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(data, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(data, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (startsWith(data, [0x52, 0x49, 0x46, 0x46]) && startsWith(data, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (startsWith(data, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  return null;
}

/** PDFs can only embed PNG and JPEG, so that is all a logo, chop or signature may be. */
export const BRANDING_TYPES = ['image/png', 'image/jpeg'];

export function fileDto(file: Pick<FileDoc, '_id' | 'filename' | 'contentType' | 'size'>): FileDto {
  return { id: String(file._id), filename: file.filename, contentType: file.contentType, size: file.size };
}

/** Who may open a file: branding needs office access; a receipt is for its uploader and the office. */
export function mayReadFile(user: UserDoc, file: Pick<FileDoc, 'purpose' | 'uploadedBy'>): boolean {
  if (file.purpose === 'branding') return can(user.role, 'companies.view');
  return String(file.uploadedBy) === String(user._id) || can(user.role, 'claims.viewAll');
}

/**
 * Checks file ids arriving on a form: each must exist, be the right kind, and
 * be one this person may attach. Ids already saved on the record are accepted
 * as they are, so an office user can edit a claim without re-owning its receipts.
 */
export async function assertFilesUsable(
  user: UserDoc,
  purpose: FilePurpose,
  entries: { id: string | null; path: string }[],
  alreadyAttached: ReadonlySet<string> = new Set(),
): Promise<void> {
  const wanted = entries.filter((entry): entry is { id: string; path: string } => entry.id !== null && !alreadyAttached.has(entry.id));
  if (wanted.length === 0) return;
  const files = await FileUpload.find({ _id: { $in: wanted.map((entry) => entry.id) } }).select('purpose uploadedBy');
  const byId = new Map(files.map((file) => [String(file._id), file]));
  const fields: Record<string, string> = {};
  for (const entry of wanted) {
    const file = byId.get(entry.id);
    const usable = file && file.purpose === purpose && (purpose === 'branding' || String(file.uploadedBy) === String(user._id));
    if (!usable) fields[entry.path] = 'That file is not available. Upload it again';
  }
  if (Object.keys(fields).length > 0) throw validationError(fields);
}

/** An image as a data URI for a PDF, or '' when there is none. */
export async function imageDataUri(fileId: unknown): Promise<string> {
  if (!fileId) return '';
  const file = await FileUpload.findById(fileId).select('+data contentType');
  if (!file || !BRANDING_TYPES.includes(file.contentType)) return '';
  return `data:${file.contentType};base64,${file.data.toString('base64')}`;
}
