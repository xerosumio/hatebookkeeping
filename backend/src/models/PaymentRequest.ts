import mongoose, { Document, Schema } from 'mongoose';

export interface IPaymentRequest extends Document {
  requestNumber: string;
  type: 'salary' | 'reimbursement' | 'vendor_payment' | 'other';
  payee: string;
  description: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  createdBy: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  executedAt?: Date;
  bankReference?: string;
  attachments: string[];
  createdAt: Date;
  updatedAt: Date;
}

const paymentRequestSchema = new Schema<IPaymentRequest>(
  {
    requestNumber: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ['salary', 'reimbursement', 'vendor_payment', 'other'],
      required: true,
    },
    payee: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'executed'],
      default: 'pending',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    executedAt: { type: Date },
    bankReference: { type: String },
    attachments: [{ type: String }],
  },
  { timestamps: true },
);

paymentRequestSchema.index({ status: 1 });

export const PaymentRequest = mongoose.model<IPaymentRequest>('PaymentRequest', paymentRequestSchema);
