import mongoose, { Document, Schema } from 'mongoose';

export interface ITransaction extends Document {
  date: Date;
  accountingDate?: Date;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  entity?: mongoose.Types.ObjectId;
  client?: mongoose.Types.ObjectId;
  payee?: mongoose.Types.ObjectId;
  invoice?: mongoose.Types.ObjectId;
  receipt?: mongoose.Types.ObjectId;
  paymentRequest?: mongoose.Types.ObjectId;
  bankReference: string;
  bankAccount: string;
  reconciled: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    date: { type: Date, required: true },
    accountingDate: { type: Date },
    type: { type: String, enum: ['income', 'expense'], required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    entity: { type: Schema.Types.ObjectId, ref: 'Entity' },
    client: { type: Schema.Types.ObjectId, ref: 'Client' },
    payee: { type: Schema.Types.ObjectId, ref: 'Payee' },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    receipt: { type: Schema.Types.ObjectId, ref: 'Receipt' },
    paymentRequest: { type: Schema.Types.ObjectId, ref: 'PaymentRequest' },
    bankReference: { type: String, default: '' },
    bankAccount: { type: String, default: '' },
    reconciled: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

transactionSchema.index({ date: 1 });
transactionSchema.index({ type: 1, date: 1 });
transactionSchema.index({ accountingDate: 1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
