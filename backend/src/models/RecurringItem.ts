import mongoose, { Document, Schema } from 'mongoose';

export interface IRecurringHistoryEntry {
  date: Date;
  action: 'generated_invoice' | 'generated_payment_request' | 'alert_sent';
  referenceId?: mongoose.Types.ObjectId;
  referenceModel?: 'Invoice' | 'PaymentRequest';
  note?: string;
}

export interface IRecurringItem extends Document {
  name: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  client?: mongoose.Types.ObjectId;
  payee?: mongoose.Types.ObjectId;
  description: string;
  startDate: Date;
  endDate?: Date;
  active: boolean;
  dueDay: number;
  alertDaysBefore: number;
  paymentTerms: string;
  bankAccountInfo: string;
  lastGeneratedDate?: Date;
  lastGeneratedInvoice?: mongoose.Types.ObjectId;
  lastGeneratedPaymentRequest?: mongoose.Types.ObjectId;
  history: IRecurringHistoryEntry[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const historyEntrySchema = new Schema<IRecurringHistoryEntry>(
  {
    date: { type: Date, required: true },
    action: { type: String, enum: ['generated_invoice', 'generated_payment_request', 'alert_sent'], required: true },
    referenceId: { type: Schema.Types.ObjectId },
    referenceModel: { type: String, enum: ['Invoice', 'PaymentRequest'] },
    note: { type: String },
  },
  { _id: false },
);

const recurringItemSchema = new Schema<IRecurringItem>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    frequency: { type: String, enum: ['monthly', 'quarterly', 'yearly'], required: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client' },
    payee: { type: Schema.Types.ObjectId, ref: 'Payee' },
    description: { type: String, default: '' },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    active: { type: Boolean, default: true },
    dueDay: { type: Number, default: 1, min: 1, max: 28 },
    alertDaysBefore: { type: Number, default: 7, min: 0 },
    paymentTerms: { type: String, default: '' },
    bankAccountInfo: { type: String, default: '' },
    lastGeneratedDate: { type: Date },
    lastGeneratedInvoice: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    lastGeneratedPaymentRequest: { type: Schema.Types.ObjectId, ref: 'PaymentRequest' },
    history: { type: [historyEntrySchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

recurringItemSchema.index({ active: 1, frequency: 1 });

export const RecurringItem = mongoose.model<IRecurringItem>('RecurringItem', recurringItemSchema);
