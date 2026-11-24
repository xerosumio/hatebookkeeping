import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { EXPENSE_KINDS, EXPENSE_STATUSES, type ExpenseKind, type ExpenseStatus } from '@hbk/shared';
import { activitySchema, approvalSchema, type ActivityAttrs, type ApprovalAttrs } from '../../platform/activity.js';

export interface ExpenseItemAttrs {
  description: string;
  categoryId: Types.ObjectId;
  amount: number;
  /** The day this line counts on in "Billed / committed". */
  date: string;
  receiptFileId: Types.ObjectId | null;
  /** Salary runs: the staff member this line pays. */
  staffId: Types.ObjectId | null;
  note: string;
}

/**
 * Money going out. Supplier expenses, staff claims and salary runs are the
 * same kind of record and go through the same approval and payment steps;
 * `kind` only decides who may see it and how it was entered.
 */
export interface ExpenseAttrs {
  number: string;
  kind: ExpenseKind;
  status: ExpenseStatus;
  companyId: Types.ObjectId;
  title: string;
  payeeId: Types.ObjectId | null;
  claimantId: Types.ObjectId | null;
  claimantName: string;
  salaryMonth: string | null;
  /** `${companyId}:${month}` while a salary run stands for that month; unique, freed when the run is reversed. */
  salarySlot?: string;
  /** `${recurringItemId}:${period}` for an expense a recurring item produced. */
  recurringSlot?: string;
  expenseDate: string;
  dueDate: string | null;
  items: ExpenseItemAttrs[];
  total: number;
  notes: string;
  attachmentIds: Types.ObjectId[];
  approvals: ApprovalAttrs[];
  rejectionReason: string;
  /** Everyone who wrote or changed this, and the person it pays. None of them may approve it. */
  authorIds: Types.ObjectId[];
  paidDate: string | null;
  paymentReference: string;
  reversalReason: string;
  activity: ActivityAttrs[];
  createdById: Types.ObjectId;
  createdByName: string;
  createdAt: Date;
}

const itemSchema = new Schema<ExpenseItemAttrs>(
  {
    description: { type: String, required: true },
    categoryId: { type: Schema.Types.ObjectId, required: true },
    amount: { type: Number, required: true },
    date: { type: String, required: true },
    receiptFileId: { type: Schema.Types.ObjectId, ref: 'FileUpload', default: null },
    staffId: { type: Schema.Types.ObjectId, ref: 'StaffMember', default: null },
    note: { type: String, default: '' },
  },
  { _id: false },
);

const expenseSchema = new Schema<ExpenseAttrs>(
  {
    number: { type: String, required: true, unique: true },
    kind: { type: String, enum: EXPENSE_KINDS, required: true, index: true },
    status: { type: String, enum: EXPENSE_STATUSES, default: 'draft', index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    title: { type: String, required: true },
    payeeId: { type: Schema.Types.ObjectId, ref: 'Payee', default: null, index: true },
    claimantId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    claimantName: { type: String, default: '' },
    salaryMonth: { type: String, default: null },
    salarySlot: { type: String },
    recurringSlot: { type: String },
    expenseDate: { type: String, required: true, index: true },
    dueDate: { type: String, default: null },
    items: { type: [itemSchema], default: [] },
    total: { type: Number, required: true },
    notes: { type: String, default: '' },
    attachmentIds: [{ type: Schema.Types.ObjectId, ref: 'FileUpload' }],
    approvals: { type: [approvalSchema], default: [] },
    rejectionReason: { type: String, default: '' },
    authorIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    paidDate: { type: String, default: null, index: true },
    paymentReference: { type: String, default: '' },
    reversalReason: { type: String, default: '' },
    activity: { type: [activitySchema], default: [] },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true, optimisticConcurrency: true },
);

expenseSchema.index({ salarySlot: 1 }, { unique: true, sparse: true });
expenseSchema.index({ recurringSlot: 1 }, { unique: true, sparse: true });

export const Expense = model<ExpenseAttrs>('Expense', expenseSchema);
export type ExpenseDoc = HydratedDocument<ExpenseAttrs>;
