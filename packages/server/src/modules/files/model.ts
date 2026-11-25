import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export const FILE_PURPOSES = ['branding', 'receipt'] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

/**
 * Uploaded files live in the database, not on disk, so they are covered by
 * the same backup as everything else and are only reachable through the API.
 */
export interface FileAttrs {
  filename: string;
  contentType: string;
  size: number;
  data: Buffer;
  purpose: FilePurpose;
  uploadedBy: Types.ObjectId;
}

const fileSchema = new Schema<FileAttrs>(
  {
    filename: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true, select: false },
    purpose: { type: String, enum: FILE_PURPOSES, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const FileUpload = model<FileAttrs>('FileUpload', fileSchema);
export type FileDoc = HydratedDocument<FileAttrs>;
