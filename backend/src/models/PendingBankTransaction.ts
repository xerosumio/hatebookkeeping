import mongoose, { Document, Schema } from 'mongoose';

export interface IPendingBankTransaction extends Document {
  airwallexId: string;
  entity: 'ax' | 'nt';
  type: 'income' | 'expense';
  amount: number;
  rawAmount: number;
  date: Date;
  description: string;
  sourceType: string;
  transactionType: string;
  batchId: string;
  status: 'pending' | 'matched' | 'dismissed';
  matchedTransaction?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  note?: string;
}

const pendingBankTransactionSchema = new Schema<IPendingBankTransaction>(
  {
    airwallexId: { type: String, required: true, unique: true },
    entity: { type: String, enum: ['ax', 'nt'], required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true },
    rawAmount: { type: Number, required: true },
    date: { type: Date, required: true },
    description: { type: String, default: '' },
    sourceType: { type: String, default: '' },
    transactionType: { type: String, default: '' },
    batchId: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'matched', 'dismissed'], default: 'pending' },
    matchedTransaction: { type: Schema.Types.ObjectId, ref: 'Transaction' },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String },
  },
  { timestamps: true },
);

pendingBankTransactionSchema.index({ status: 1, entity: 1 });

export const PendingBankTransaction = mongoose.model<IPendingBankTransaction>(
  'PendingBankTransaction',
  pendingBankTransactionSchema,
);
