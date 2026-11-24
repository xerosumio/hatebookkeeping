import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface CompanyAttrs {
  code: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  brandColor: string;
  bankDetails: string;
  quoteTerms: string;
  logoFileId: Types.ObjectId | null;
  chopFileId: Types.ObjectId | null;
  signatureFileId: Types.ObjectId | null;
  active: boolean;
}

const fileRef = { type: Schema.Types.ObjectId, ref: 'FileUpload', default: null };

const companySchema = new Schema<CompanyAttrs>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' },
    brandColor: { type: String, default: '' },
    bankDetails: { type: String, default: '' },
    quoteTerms: { type: String, default: '' },
    logoFileId: fileRef,
    chopFileId: fileRef,
    signatureFileId: fileRef,
    active: { type: Boolean, default: true },
  },
  { timestamps: true, optimisticConcurrency: true },
);

export const Company = model<CompanyAttrs>('Company', companySchema);
export type CompanyDoc = HydratedDocument<CompanyAttrs>;

/** The last number handed out for one series. Only ever goes up. */
export interface CounterAttrs {
  key: string;
  seq: number;
}

const counterSchema = new Schema<CounterAttrs>({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, required: true, default: 0 },
});

export const Counter = model<CounterAttrs>('Counter', counterSchema);
