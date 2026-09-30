import mongoose, { Document, Schema } from 'mongoose';

export interface IFileUpload extends Document {
  filename: string;
  contentType: string;
  data: Buffer;
  size: number;
  createdAt: Date;
}

const fileUploadSchema = new Schema<IFileUpload>(
  {
    filename: { type: String, required: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: true },
);

export const FileUpload = mongoose.model<IFileUpload>('FileUpload', fileUploadSchema);
