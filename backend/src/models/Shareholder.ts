import mongoose, { Document, Schema } from 'mongoose';

export interface IShareAdjustmentLog {
  previousPercent: number;
  newPercent: number;
  date: Date;
  reason: string;
  changedBy: mongoose.Types.ObjectId;
}

export interface IShareholder extends Document {
  user: mongoose.Types.ObjectId;
  name: string;
  sharePercent: number;
  active: boolean;
  shareHistory: IShareAdjustmentLog[];
  createdAt: Date;
  updatedAt: Date;
}

const shareAdjustmentLogSchema = new Schema<IShareAdjustmentLog>(
  {
    previousPercent: { type: Number, required: true },
    newPercent: { type: Number, required: true },
    date: { type: Date, required: true },
    reason: { type: String, default: '' },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: false },
);

const shareholderSchema = new Schema<IShareholder>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    sharePercent: { type: Number, required: true },
    active: { type: Boolean, default: true },
    shareHistory: { type: [shareAdjustmentLogSchema], default: [] },
  },
  { timestamps: true },
);

shareholderSchema.index({ user: 1 }, { unique: true });

export const Shareholder = mongoose.model<IShareholder>('Shareholder', shareholderSchema);
