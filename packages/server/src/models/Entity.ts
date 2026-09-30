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
  defaultBankAccountIndex: number;
  brandColor: string;
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
        bankCode: { type: String, default: '' },
        branchCode: { type: String, default: '' },
        swiftCode: { type: String, default: '' },
        location: { type: String, default: '' },
      }],
      default: [],
    },
    defaultBankAccountIndex: { type: Number, default: 0 },
    brandColor: { type: String, default: '' },
    companyChopUrl: { type: String, default: '' },
    signatureUrl: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Entity = mongoose.model<IEntity>('Entity', entitySchema);
