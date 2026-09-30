import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: 'recurring_due';
  link: string;
  read: boolean;
  /** Used for deduplication: e.g. "recurring:<itemId>:<periodKey>" */
  dedupKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['recurring_due'], required: true },
    link: { type: String, required: true },
    read: { type: Boolean, default: false },
    dedupKey: { type: String },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ dedupKey: 1 }, { sparse: true });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
