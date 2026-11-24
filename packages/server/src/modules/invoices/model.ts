import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  DISCOUNT_TYPES,
  INVOICE_STATUSES,
  PAYMENT_METHODS,
  type ComputedLineItem,
  type DiscountType,
  type InvoiceStatus,
  type PaymentMethod,
} from '@hbk/shared';
import { activitySchema, type ActivityAttrs } from '../../platform/activity.js';
import { lineItemSchema } from '../../platform/lines.js';

export interface InvoiceAttrs {
  /** Empty while a draft; given when the invoice is issued, so numbers have no gaps from deleted drafts. */
  number: string;
  status: InvoiceStatus;
  companyId: Types.ObjectId;
  clientId: Types.ObjectId;
  title: string;
  issueDate: string;
  dueDate: string | null;
  lineItems: ComputedLineItem[];
  discountType: DiscountType;
  discountValue: number;
  subtotal: number;
  discount: number;
  total: number;
  /** The sum of payments that are not voided. Only changed together with a payment. */
  amountPaid: number;
  notes: string;
  /** null: print the company's current bank details. */
  bankDetails: string | null;
  cancelReason: string;
  quoteId: Types.ObjectId | null;
  quoteNumber: string;
  milestoneId: Types.ObjectId | null;
  milestoneLabel: string;
  /**
   * `${quoteId}:${milestoneId | 'full'}` while this invoice stands for that
   * part of a quote. The unique index is what stops a quote being invoiced
   * twice; cancelling the invoice frees the slot.
   */
  quoteSlot?: string;
  /** `${recurringItemId}:${period}` for an invoice a recurring item produced. */
  recurringSlot?: string;
  activity: ActivityAttrs[];
  createdById: Types.ObjectId;
  createdByName: string;
  createdAt: Date;
}

const invoiceSchema = new Schema<InvoiceAttrs>(
  {
    number: { type: String, default: '' },
    status: { type: String, enum: INVOICE_STATUSES, default: 'draft', index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    title: { type: String, default: '' },
    issueDate: { type: String, required: true, index: true },
    dueDate: { type: String, default: null },
    lineItems: { type: [lineItemSchema], default: [] },
    discountType: { type: String, enum: DISCOUNT_TYPES, default: 'none' },
    discountValue: { type: Number, default: 0 },
    subtotal: { type: Number, required: true },
    discount: { type: Number, required: true },
    total: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    bankDetails: { type: String, default: null },
    cancelReason: { type: String, default: '' },
    quoteId: { type: Schema.Types.ObjectId, ref: 'Quote', default: null, index: true },
    quoteNumber: { type: String, default: '' },
    milestoneId: { type: Schema.Types.ObjectId, default: null },
    milestoneLabel: { type: String, default: '' },
    quoteSlot: { type: String },
    recurringSlot: { type: String },
    activity: { type: [activitySchema], default: [] },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true, optimisticConcurrency: true },
);

invoiceSchema.index({ quoteSlot: 1 }, { unique: true, sparse: true });
invoiceSchema.index({ recurringSlot: 1 }, { unique: true, sparse: true });
invoiceSchema.index({ number: 1 }, { unique: true, partialFilterExpression: { number: { $gt: '' } } });

export const Invoice = model<InvoiceAttrs>('Invoice', invoiceSchema);
export type InvoiceDoc = HydratedDocument<InvoiceAttrs>;

export interface PaymentAttrs {
  /** The receipt number. */
  number: string;
  invoiceId: Types.ObjectId;
  companyId: Types.ObjectId;
  clientId: Types.ObjectId;
  amount: number;
  date: string;
  method: PaymentMethod;
  reference: string;
  notes: string;
  voided: boolean;
  voidReason: string;
  voidedAt: Date | null;
  createdById: Types.ObjectId;
  createdByName: string;
  createdAt: Date;
}

const paymentSchema = new Schema<PaymentAttrs>(
  {
    number: { type: String, required: true, unique: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    amount: { type: Number, required: true },
    date: { type: String, required: true, index: true },
    method: { type: String, enum: PAYMENT_METHODS, default: 'bank_transfer' },
    reference: { type: String, default: '' },
    notes: { type: String, default: '' },
    voided: { type: Boolean, default: false },
    voidReason: { type: String, default: '' },
    voidedAt: { type: Date, default: null },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true },
);

export const Payment = model<PaymentAttrs>('Payment', paymentSchema);
export type PaymentDoc = HydratedDocument<PaymentAttrs>;
