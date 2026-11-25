import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { DISCOUNT_TYPES, QUOTE_STATUSES, type ComputedLineItem, type DiscountType, type QuoteStatus } from '@hbk/shared';
import { activitySchema, approvalSchema, type ActivityAttrs, type ApprovalAttrs } from '../../platform/activity.js';
import { lineItemSchema } from '../../platform/lines.js';

export interface MilestoneAttrs {
  _id: Types.ObjectId;
  label: string;
  percentage: number;
  dueDescription: string;
  amount: number;
}

export interface QuoteAttrs {
  number: string;
  status: QuoteStatus;
  companyId: Types.ObjectId;
  clientId: Types.ObjectId;
  title: string;
  issueDate: string;
  validUntil: string | null;
  lineItems: ComputedLineItem[];
  discountType: DiscountType;
  discountValue: number;
  subtotal: number;
  discount: number;
  total: number;
  paymentSchedule: Types.DocumentArray<MilestoneAttrs>;
  terms: string;
  notes: string;
  approvals: ApprovalAttrs[];
  rejectionReason: string;
  /** Everyone who wrote or changed the content now awaiting approval. None of them may approve it. */
  authorIds: Types.ObjectId[];
  activity: ActivityAttrs[];
  createdById: Types.ObjectId;
  createdByName: string;
  createdAt: Date;
}

const milestoneSchema = new Schema<MilestoneAttrs>({
  label: { type: String, required: true },
  percentage: { type: Number, required: true },
  dueDescription: { type: String, default: '' },
  amount: { type: Number, required: true },
});

const quoteSchema = new Schema<QuoteAttrs>(
  {
    number: { type: String, required: true, unique: true },
    status: { type: String, enum: QUOTE_STATUSES, default: 'draft', index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    title: { type: String, required: true },
    issueDate: { type: String, required: true },
    validUntil: { type: String, default: null },
    lineItems: { type: [lineItemSchema], default: [] },
    discountType: { type: String, enum: DISCOUNT_TYPES, default: 'none' },
    discountValue: { type: Number, default: 0 },
    subtotal: { type: Number, required: true },
    discount: { type: Number, required: true },
    total: { type: Number, required: true },
    paymentSchedule: { type: [milestoneSchema], default: [] },
    terms: { type: String, default: '' },
    notes: { type: String, default: '' },
    approvals: { type: [approvalSchema], default: [] },
    rejectionReason: { type: String, default: '' },
    authorIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    activity: { type: [activitySchema], default: [] },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true, optimisticConcurrency: true },
);

export const Quote = model<QuoteAttrs>('Quote', quoteSchema);
export type QuoteDoc = HydratedDocument<QuoteAttrs>;
