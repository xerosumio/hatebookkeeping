import mongoose, { Document, Schema } from 'mongoose';

export interface IPaymentRequestItem {
  payee: mongoose.Types.ObjectId;
  description: string;
  amount: number;
  category: string;
  recipient: string;
}

export interface IActivityLogEntry {
  action: 'created' | 'updated' | 'approved' | 'rejected' | 'executed' | 'notified';
  user: mongoose.Types.ObjectId;
  timestamp: Date;
  note?: string;
}

export interface IApprovalEntry {
  user: mongoose.Types.ObjectId;
  at: Date;
}

export interface IPaymentRequest extends Document {
  requestNumber: string;
  entity?: mongoose.Types.ObjectId;
  description: string;
  items: IPaymentRequestItem[];
  totalAmount: number;
  sourceBankAccount: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  createdBy: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  approvals: IApprovalEntry[];
  rejectionReason?: string;
  executedAt?: Date;
  bankReference?: string;
  sourceReimbursement?: mongoose.Types.ObjectId;
  attachments: string[];
  notifiedEmails: string[];
  activityLog: IActivityLogEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<IPaymentRequestItem>(
  {
    payee: { type: Schema.Types.ObjectId, ref: 'Payee', required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    recipient: { type: String, default: '' },
  },
  { _id: false },
);

const activityLogSchema = new Schema<IActivityLogEntry>(
  {
    action: {
      type: String,
      enum: ['created', 'updated', 'approved', 'rejected', 'executed', 'notified'],
      required: true,
    },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, required: true },
    note: { type: String },
  },
  { _id: false },
);

const paymentRequestSchema = new Schema<IPaymentRequest>(
  {
    requestNumber: { type: String, required: true, unique: true },
    entity: { type: Schema.Types.ObjectId, ref: 'Entity' },
    description: { type: String, default: '' },
    items: [itemSchema],
    totalAmount: { type: Number, required: true },
    sourceBankAccount: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'executed'],
      default: 'pending',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    approvals: [{
      user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      at: { type: Date, required: true },
    }],
    rejectionReason: { type: String },
    executedAt: { type: Date },
    bankReference: { type: String },
    sourceReimbursement: { type: Schema.Types.ObjectId, ref: 'Reimbursement' },
    attachments: [{ type: String }],
    notifiedEmails: [{ type: String }],
    activityLog: [activityLogSchema],
  },
  { timestamps: true },
);

paymentRequestSchema.index({ status: 1 });

export const PaymentRequest = mongoose.model<IPaymentRequest>('PaymentRequest', paymentRequestSchema);
