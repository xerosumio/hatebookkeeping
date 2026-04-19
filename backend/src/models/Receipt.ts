import mongoose, { Document, Schema } from 'mongoose';

export interface IReceipt extends Document {
  receiptNumber: string;
  entity?: mongoose.Types.ObjectId;
  invoice: mongoose.Types.ObjectId;
  client: mongoose.Types.ObjectId;
  amount: number;
  paymentMethod: string;
  paymentDate: Date;
  bankReference: string;
  bankAccount: string;
  notes: string;
  companyChopUrl: string;
  signatureUrl: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const receiptSchema = new Schema<IReceipt>(
  {
    receiptNumber: { type: String, required: true, unique: true },
    entity: { type: Schema.Types.ObjectId, ref: 'Entity' },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, default: 'bank_transfer' },
    paymentDate: { type: Date, required: true },
    bankReference: { type: String, default: '' },
    bankAccount: { type: String, default: '' },
    notes: { type: String, default: '' },
    companyChopUrl: { type: String, default: '' },
    signatureUrl: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const Receipt = mongoose.model<IReceipt>('Receipt', receiptSchema);
