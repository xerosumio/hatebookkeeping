import mongoose, { Document, Schema } from 'mongoose';

export interface IInvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  entity: mongoose.Types.ObjectId;
  quotation?: mongoose.Types.ObjectId;
  client: mongoose.Types.ObjectId;
  status: 'unpaid' | 'partial' | 'paid';
  lineItems: IInvoiceLineItem[];
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  milestone: string;
  paymentTerms: string;
  dueDate?: Date;
  notes: string;
  bankAccountInfo: string;
  companyChopUrl: string;
  signatureUrl: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const lineItemSchema = new Schema<IInvoiceLineItem>(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false },
);

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    entity: { type: Schema.Types.ObjectId, ref: 'Entity', required: true },
    quotation: { type: Schema.Types.ObjectId, ref: 'Quotation' },
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
    },
    lineItems: [lineItemSchema],
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, required: true },
    milestone: { type: String, default: '' },
    paymentTerms: { type: String, default: '' },
    dueDate: { type: Date },
    notes: { type: String, default: '' },
    bankAccountInfo: { type: String, default: '' },
    companyChopUrl: { type: String, default: '' },
    signatureUrl: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

invoiceSchema.index({ client: 1 });
invoiceSchema.index({ status: 1 });

export const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);
