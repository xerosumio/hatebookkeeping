import mongoose, { Document, Schema } from 'mongoose';

export interface ITransaction extends Document {
  date: Date;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  invoice?: mongoose.Types.ObjectId;
  receipt?: mongoose.Types.ObjectId;
  paymentRequest?: mongoose.Types.ObjectId;
  bankReference: string;
  bankAccount: string;
  reconciled: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    date: { type: Date, required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    category: {
      type: String,
      enum: [
        'revenue',
        'salary',
        'reimbursement',
        'rent',
        'utilities',
        'software_subscription',
        'professional_fees',
        'tax',
        'other',
      ],
      required: true,
    },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    receipt: { type: Schema.Types.ObjectId, ref: 'Receipt' },
    paymentRequest: { type: Schema.Types.ObjectId, ref: 'PaymentRequest' },
    bankReference: { type: String, default: '' },
    bankAccount: { type: String, default: '' },
    reconciled: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

transactionSchema.index({ date: 1 });
transactionSchema.index({ type: 1, date: 1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
