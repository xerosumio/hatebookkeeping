import mongoose, { Document, Schema } from 'mongoose';

export interface ILineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  waived: boolean;
}

export interface IPaymentMilestone {
  milestone: string;
  percentage: number;
  amount: number;
  dueDescription: string;
}

export interface IQuotationActivityLog {
  action: 'created' | 'updated' | 'pending_approval' | 'approved' | 'rejected' | 'sent' | 'accepted' | 'client_rejected' | 'notified';
  user: mongoose.Types.ObjectId;
  timestamp: Date;
  note?: string;
}

export interface IQuotation extends Document {
  quotationNumber: string;
  entity: mongoose.Types.ObjectId;
  client: mongoose.Types.ObjectId;
  status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'accepted' | 'rejected';
  title: string;
  lineItems: ILineItem[];
  subtotal: number;
  discount: number;
  discountPercent: number;
  total: number;
  termsAndConditions: string;
  paymentSchedule: IPaymentMilestone[];
  companyChopUrl: string;
  signatureUrl: string;
  validUntil: Date;
  notes: string;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  notifiedEmails: string[];
  activityLog: IQuotationActivityLog[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const lineItemSchema = new Schema<ILineItem>(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    amount: { type: Number, required: true },
    waived: { type: Boolean, default: false },
  },
  { _id: false },
);

const paymentMilestoneSchema = new Schema<IPaymentMilestone>(
  {
    milestone: { type: String, required: true },
    percentage: { type: Number, required: true },
    amount: { type: Number, required: true },
    dueDescription: { type: String, default: '' },
  },
  { _id: false },
);

const quotationActivityLogSchema = new Schema<IQuotationActivityLog>(
  {
    action: {
      type: String,
      enum: ['created', 'updated', 'pending_approval', 'approved', 'rejected', 'sent', 'accepted', 'client_rejected', 'notified'],
      required: true,
    },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, required: true },
    note: { type: String },
  },
  { _id: false },
);

const quotationSchema = new Schema<IQuotation>(
  {
    quotationNumber: { type: String, required: true, unique: true },
    entity: { type: Schema.Types.ObjectId, ref: 'Entity', required: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'sent', 'accepted', 'rejected'],
      default: 'draft',
    },
    title: { type: String, required: true, trim: true },
    lineItems: [lineItemSchema],
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    total: { type: Number, required: true },
    termsAndConditions: { type: String, default: '' },
    paymentSchedule: [paymentMilestoneSchema],
    companyChopUrl: { type: String, default: '' },
    signatureUrl: { type: String, default: '' },
    validUntil: { type: Date },
    notes: { type: String, default: '' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    notifiedEmails: [{ type: String }],
    activityLog: [quotationActivityLogSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

quotationSchema.index({ client: 1 });
quotationSchema.index({ status: 1 });

export const Quotation = mongoose.model<IQuotation>('Quotation', quotationSchema);
