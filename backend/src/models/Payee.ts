import mongoose, { Document, Schema } from 'mongoose';

export interface IPayee extends Document {
  name: string;
  bankName: string;
  bankAccountNumber: string;
  bankCode: string;
  notes: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const payeeSchema = new Schema<IPayee>(
  {
    name: { type: String, required: true, trim: true },
    bankName: { type: String, default: '' },
    bankAccountNumber: { type: String, default: '' },
    bankCode: { type: String, default: '' },
    notes: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

payeeSchema.index({ name: 1 });

export const Payee = mongoose.model<IPayee>('Payee', payeeSchema);
