import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { FREQUENCIES, RECURRING_KINDS, type EmailStatus, type Frequency, type RecurringKind } from '@hbk/shared';

export interface ReminderAttrs {
  /** The due date the reminder was about. */
  period: string;
  /** Whether it was the second reminder, sent after the due date passed. */
  overdue: boolean;
  at: Date;
  status: EmailStatus;
  detail: string;
}

/**
 * Something that comes round on a schedule: an invoice to raise or a bill to
 * pay. It does not create anything by itself. When a period comes due the
 * office is reminded, and a person generates the draft (or skips the period).
 */
export interface RecurringAttrs {
  kind: RecurringKind;
  name: string;
  companyId: Types.ObjectId;
  clientId: Types.ObjectId | null;
  payeeId: Types.ObjectId | null;
  categoryId: Types.ObjectId | null;
  description: string;
  amount: number;
  frequency: Frequency;
  startDate: string;
  endDate: string | null;
  dayOfMonth: number;
  remindDaysBefore: number;
  paymentTermsDays: number;
  active: boolean;
  reminders: ReminderAttrs[];
  createdById: Types.ObjectId;
  createdByName: string;
}

const reminderSchema = new Schema<ReminderAttrs>(
  {
    period: { type: String, required: true },
    overdue: { type: Boolean, default: false },
    at: { type: Date, required: true },
    status: { type: String, required: true },
    detail: { type: String, default: '' },
  },
  { _id: false },
);

const recurringSchema = new Schema<RecurringAttrs>(
  {
    kind: { type: String, enum: RECURRING_KINDS, required: true },
    name: { type: String, required: true, trim: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', default: null, index: true },
    payeeId: { type: Schema.Types.ObjectId, ref: 'Payee', default: null, index: true },
    categoryId: { type: Schema.Types.ObjectId, default: null },
    description: { type: String, default: '' },
    amount: { type: Number, required: true },
    frequency: { type: String, enum: FREQUENCIES, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, default: null },
    dayOfMonth: { type: Number, required: true },
    remindDaysBefore: { type: Number, default: 7 },
    paymentTermsDays: { type: Number, default: 14 },
    active: { type: Boolean, default: true },
    reminders: { type: [reminderSchema], default: [] },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true, optimisticConcurrency: true },
);

export const RecurringItem = model<RecurringAttrs>('RecurringItem', recurringSchema);
export type RecurringDoc = HydratedDocument<RecurringAttrs>;

/**
 * One row per item and month that has been dealt with. The unique index is
 * what makes a period generate at most once, however many people (or tabs)
 * press the button. It is keyed by month, so moving the day of the month
 * later does not make an already-handled month come due again.
 */
export interface RecurringRunAttrs {
  itemId: Types.ObjectId;
  month: string;
  period: string;
  action: 'generated' | 'skipped';
  documentId: Types.ObjectId | null;
  userId: Types.ObjectId;
  userName: string;
  createdAt: Date;
}

const runSchema = new Schema<RecurringRunAttrs>(
  {
    itemId: { type: Schema.Types.ObjectId, ref: 'RecurringItem', required: true },
    month: { type: String, required: true },
    period: { type: String, required: true },
    action: { type: String, enum: ['generated', 'skipped'], required: true },
    documentId: { type: Schema.Types.ObjectId, default: null },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
  },
  { timestamps: true },
);
runSchema.index({ itemId: 1, month: 1 }, { unique: true });

export const RecurringRun = model<RecurringRunAttrs>('RecurringRun', runSchema);
export type RecurringRunDoc = HydratedDocument<RecurringRunAttrs>;
