import { Schema, model, type HydratedDocument } from 'mongoose';

export interface ClientAttrs {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  archived: boolean;
}

const clientSchema = new Schema<ClientAttrs>(
  {
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    notes: { type: String, default: '' },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true, optimisticConcurrency: true },
);

export const Client = model<ClientAttrs>('Client', clientSchema);
export type ClientDoc = HydratedDocument<ClientAttrs>;
