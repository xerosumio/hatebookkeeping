import mongoose, { Document, Schema } from 'mongoose';
import type { IBankAccount } from './Settings.js';

export interface IEntity extends Document {
  code: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  bankAccounts: IBankAccount[];
  companyChopUrl: string;
  signatureUrl: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const entitySchema = new Schema<IEntity>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    bankAccounts: {
      type: [{
        name: { type: String, required: true },
        bankName: { type: String, default: '' },
        accountNumber: { type: String, default: '' },
      }],
      default: [],
    },
    companyChopUrl: { type: String, default: '' },
    signatureUrl: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Entity = mongoose.model<IEntity>('Entity', entitySchema);
