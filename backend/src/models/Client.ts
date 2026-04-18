import mongoose, { Document, Schema } from 'mongoose';

export interface IClient extends Document {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const clientSchema = new Schema<IClient>(
  {
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    notes: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

clientSchema.index({ name: 'text' });

export const Client = mongoose.model<IClient>('Client', clientSchema);
