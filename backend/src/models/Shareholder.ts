import mongoose, { Document, Schema } from 'mongoose';

export interface IShareholder extends Document {
  user: mongoose.Types.ObjectId;
  name: string;
  sharePercent: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const shareholderSchema = new Schema<IShareholder>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    sharePercent: { type: Number, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

shareholderSchema.index({ user: 1 }, { unique: true });

export const Shareholder = mongoose.model<IShareholder>('Shareholder', shareholderSchema);
