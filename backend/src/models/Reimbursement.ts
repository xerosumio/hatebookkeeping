import mongoose, { Document, Schema } from 'mongoose';

export interface IReimbursementItem {
  date: Date;
  description: string;
  amount: number;
  category: string;
  receiptUrl: string;
  notes: string;
}

export interface IReimbursement extends Document {
  reimbursementNumber: string;
  entity?: mongoose.Types.ObjectId;
  title: string;
  submittedBy: mongoose.Types.ObjectId;
  items: IReimbursementItem[];
  totalAmount: number;
  paymentRequest?: mongoose.Types.ObjectId;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const reimbursementItemSchema = new Schema<IReimbursementItem>(
  {
    date: { type: Date, required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    receiptUrl: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { _id: false },
);

const reimbursementSchema = new Schema<IReimbursement>(
  {
    reimbursementNumber: { type: String, required: true, unique: true },
    entity: { type: Schema.Types.ObjectId, ref: 'Entity' },
    title: { type: String, required: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: [reimbursementItemSchema],
    totalAmount: { type: Number, required: true },
    paymentRequest: { type: Schema.Types.ObjectId, ref: 'PaymentRequest' },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

reimbursementSchema.index({ submittedBy: 1 });

export const Reimbursement = mongoose.model<IReimbursement>('Reimbursement', reimbursementSchema);
