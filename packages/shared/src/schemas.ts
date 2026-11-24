import { z } from 'zod';
import { isValidMonth, isValidYmd } from './dates.js';
import { MAX_CENTS } from './money.js';
import { ROLES } from './permissions.js';
import { FREQUENCIES } from './recurring.js';
import { computeTotals, DISCOUNT_TYPES } from './totals.js';

/**
 * One schema per input. The server validates every request body with these,
 * and the web app validates the same object before sending it, so a person
 * sees the same message in the form that the server would have returned.
 */

const OBJECT_ID = /^[a-f0-9]{24}$/i;

const emptyToNull = (value: unknown) => (value === '' || value === undefined ? null : value);

/** Free text that may be left empty. `null` and a missing key both mean empty. */
const text = (max: number) =>
  z.preprocess(
    (value) => value ?? '',
    z.string({ invalid_type_error: 'Enter text here' }).trim().max(max, `Keep this under ${max} characters`),
  );

const requiredText = (what: string, max = 200) =>
  z.preprocess(
    (value) => value ?? '',
    z
      .string({ invalid_type_error: `Enter ${what}` })
      .trim()
      .min(1, `Enter ${what}`)
      .max(max, `Keep this under ${max} characters`),
  );

const id = (what: string) =>
  z.preprocess(
    (value) => value ?? '',
    z.string({ invalid_type_error: `Choose ${what}` }).regex(OBJECT_ID, `Choose ${what}`),
  );

const optionalId = z.preprocess(emptyToNull, z.string().regex(OBJECT_ID, 'That choice is not valid').nullable());

const ymd = (what: string) =>
  z.preprocess(
    (value) => value ?? '',
    z.string({ invalid_type_error: `Choose ${what}` }).refine(isValidYmd, `Choose ${what}`),
  );

const optionalYmd = z.preprocess(
  emptyToNull,
  z.string().refine(isValidYmd, 'That date is not valid').nullable(),
);

const month = z.preprocess(
  (value) => value ?? '',
  z.string({ invalid_type_error: 'Choose a month' }).refine(isValidMonth, 'Choose a month'),
);

const cents = (what: string) =>
  z
    .number({ required_error: `Enter ${what}`, invalid_type_error: `Enter ${what}` })
    .int('Amounts cannot be smaller than one cent')
    .min(0, `${capitalise(what)} cannot be negative`)
    .max(MAX_CENTS, 'That amount is too large');

const positiveCents = (what: string) => cents(what).min(1, `Enter ${what} above zero`);

const email = z.preprocess(
  (value) => value ?? '',
  z
    .string()
    .trim()
    .max(200, 'Keep this under 200 characters')
    .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid email address'),
);

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ── Reference data ──────────────────────────────────────────────────────────

export const companyInputSchema = z.object({
  code: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value ?? ''),
    z.string().regex(/^[A-Z0-9]{2,6}$/, 'Use 2 to 6 letters or digits, for example AX'),
  ),
  name: requiredText('the company name'),
  address: text(500),
  phone: text(50),
  email,
  website: text(200),
  brandColor: z.preprocess(
    (value) => value ?? '',
    z.string().trim().regex(/^(#[0-9a-fA-F]{6})?$/, 'Use a colour like #0369a1, or leave empty'),
  ),
  bankDetails: text(1000),
  quoteTerms: text(4000),
  logoFileId: optionalId,
  chopFileId: optionalId,
  signatureFileId: optionalId,
  active: z.boolean().default(true),
});
export type CompanyInput = z.output<typeof companyInputSchema>;

const nextNumber = z
  .number({ required_error: 'Enter a number', invalid_type_error: 'Enter a number' })
  .int('Enter a whole number')
  .min(1, 'Numbers start at 1')
  .max(999_999, 'That number is too large');

export const numberingInputSchema = z.object({
  quote: nextNumber,
  invoice: nextNumber,
  receipt: nextNumber,
});
export type NumberingInput = z.output<typeof numberingInputSchema>;

export const CATEGORY_TYPES = ['income', 'expense'] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const categoryCreateSchema = z.object({
  name: requiredText('a category name', 60),
  type: z.enum(CATEGORY_TYPES, { errorMap: () => ({ message: 'Choose income or expense' }) }),
});
export type CategoryCreateInput = z.output<typeof categoryCreateSchema>;

export const categoryUpdateSchema = z.object({
  name: requiredText('a category name', 60),
  active: z.boolean(),
});
export type CategoryUpdateInput = z.output<typeof categoryUpdateSchema>;

export const approvalSettingsSchema = z
  .object({
    approverIds: z.array(id('an approver')).max(20, 'Choose at most 20 approvers'),
    approvalsRequired: z
      .number({ required_error: 'Enter how many approvals are needed', invalid_type_error: 'Enter a number' })
      .int('Enter a whole number')
      .min(1, 'At least one approval is needed'),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.approverIds).size !== value.approverIds.length) {
      ctx.addIssue({ code: 'custom', path: ['approverIds'], message: 'Each approver can only be listed once' });
    }
    if (value.approverIds.length > 0 && value.approvalsRequired > value.approverIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['approvalsRequired'],
        message: `Only ${value.approverIds.length} approver(s) are chosen, so no more than that can be required`,
      });
    }
  });
export type ApprovalSettingsInput = z.output<typeof approvalSettingsSchema>;

const payoutDetails = {
  bankName: text(100),
  bankAccountNumber: text(60),
  fpsId: text(60),
};

export const userUpdateSchema = z.object({
  role: z.enum(ROLES, { errorMap: () => ({ message: 'Choose a role' }) }),
  active: z.boolean(),
  ...payoutDetails,
});
export type UserUpdateInput = z.output<typeof userUpdateSchema>;

export const profileUpdateSchema = z.object(payoutDetails);
export type ProfileUpdateInput = z.output<typeof profileUpdateSchema>;

export const clientInputSchema = z.object({
  name: requiredText('the client name'),
  contactPerson: text(200),
  email,
  phone: text(50),
  address: text(500),
  notes: text(2000),
});
export type ClientInput = z.output<typeof clientInputSchema>;

export const payeeInputSchema = z.object({
  name: requiredText('the payee name'),
  bankCode: text(20),
  notes: text(2000),
  ...payoutDetails,
});
export type PayeeInput = z.output<typeof payeeInputSchema>;

// ── Quotes and invoices ─────────────────────────────────────────────────────

const lineItemSchema = z.object({
  description: requiredText('a description', 500),
  quantity: z
    .number({ required_error: 'Enter a quantity', invalid_type_error: 'Enter a quantity' })
    .positive('Quantity must be above zero')
    .max(1_000_000, 'That quantity is too large')
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, 'Use at most 2 decimal places'),
  unitPrice: cents('a unit price'),
  waived: z.boolean().default(false),
});

const lineItems = z
  .array(lineItemSchema, { required_error: 'Add at least one line', invalid_type_error: 'Add at least one line' })
  .min(1, 'Add at least one line')
  .max(100, 'Keep to 100 lines or fewer');

const discountFields = {
  discountType: z.enum(DISCOUNT_TYPES).default('none'),
  discountValue: z
    .number({ invalid_type_error: 'Enter the discount' })
    .min(0, 'A discount cannot be negative')
    .default(0),
};

interface WithTotals {
  lineItems: z.output<typeof lineItems>;
  discountType: (typeof DISCOUNT_TYPES)[number];
  discountValue: number;
}

function checkTotals(value: WithTotals, ctx: z.RefinementCtx, options: { allowZero: boolean }) {
  if (value.discountType === 'percent' && value.discountValue > 100) {
    ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'A discount cannot be more than 100%' });
    return;
  }
  if (value.discountType === 'amount' && !Number.isInteger(value.discountValue)) {
    ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'Amounts cannot be smaller than one cent' });
    return;
  }
  const totals = computeTotals(value.lineItems, value.discountType, value.discountValue);
  if (totals.subtotal > MAX_CENTS) {
    ctx.addIssue({ code: 'custom', path: ['lineItems'], message: 'That total is too large' });
  }
  if (totals.discount > totals.subtotal) {
    ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'The discount is more than the subtotal' });
  } else if (!options.allowZero && totals.total <= 0) {
    ctx.addIssue({ code: 'custom', path: ['lineItems'], message: 'The total must be above zero' });
  }
}

const milestoneSchema = z.object({
  label: requiredText('a milestone name', 120),
  percentage: z
    .number({ required_error: 'Enter a percentage', invalid_type_error: 'Enter a percentage' })
    .positive('Enter a percentage above zero')
    .max(100, 'A percentage cannot be more than 100')
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, 'Use at most 2 decimal places'),
  dueDescription: text(200),
});

export const quoteInputSchema = z
  .object({
    companyId: id('a company'),
    clientId: id('a client'),
    title: requiredText('a title'),
    issueDate: ymd('the quote date'),
    validUntil: optionalYmd,
    lineItems,
    ...discountFields,
    paymentSchedule: z.array(milestoneSchema).max(24, 'Keep to 24 milestones or fewer').default([]),
    terms: text(4000),
    notes: text(2000),
  })
  .superRefine((value, ctx) => {
    checkTotals(value, ctx, { allowZero: true });
    if (value.validUntil && value.validUntil < value.issueDate) {
      ctx.addIssue({ code: 'custom', path: ['validUntil'], message: 'This is before the quote date' });
    }
    if (value.paymentSchedule.length > 0) {
      const sum = value.paymentSchedule.reduce((total, milestone) => total + milestone.percentage, 0);
      if (Math.abs(sum - 100) > 0.001) {
        ctx.addIssue({
          code: 'custom',
          path: ['paymentSchedule'],
          message: `The milestones add up to ${Number(sum.toFixed(2))}%. They must add up to 100%`,
        });
      }
    }
  });
export type QuoteInput = z.output<typeof quoteInputSchema>;

export const invoiceInputSchema = z
  .object({
    companyId: id('a company'),
    clientId: id('a client'),
    title: text(200),
    issueDate: ymd('the invoice date'),
    dueDate: optionalYmd,
    lineItems,
    ...discountFields,
    notes: text(2000),
    /** Left out or null: use the company's bank details. */
    bankDetails: z.preprocess((value) => value ?? null, z.string().trim().max(1000).nullable()),
  })
  .superRefine((value, ctx) => {
    checkTotals(value, ctx, { allowZero: false });
    if (value.dueDate && value.dueDate < value.issueDate) {
      ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'This is before the invoice date' });
    }
  });
export type InvoiceInput = z.output<typeof invoiceInputSchema>;

export const convertQuoteSchema = z.object({
  /** Which milestone to invoice. Leave out when the quote has no payment schedule. */
  milestoneId: optionalId,
});
export type ConvertQuoteInput = z.output<typeof convertQuoteSchema>;

export const PAYMENT_METHODS = ['bank_transfer', 'fps', 'cheque', 'cash', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  fps: 'FPS',
  cheque: 'Cheque',
  cash: 'Cash',
  other: 'Other',
};

export const paymentInputSchema = z.object({
  amount: positiveCents('the amount received'),
  date: ymd('the payment date'),
  method: z.enum(PAYMENT_METHODS).default('bank_transfer'),
  reference: text(100),
  notes: text(1000),
});
export type PaymentInput = z.output<typeof paymentInputSchema>;

export const reasonSchema = z.object({
  reason: requiredText('a reason', 500),
});
export type ReasonInput = z.output<typeof reasonSchema>;

export const optionalReasonSchema = z.object({
  reason: text(500),
});

// ── Expenses, claims and salary ─────────────────────────────────────────────

const fileIds = z.array(id('a file')).max(20, 'Attach at most 20 files').default([]);

const expenseItemSchema = z.object({
  description: requiredText('a description', 300),
  categoryId: id('a category'),
  amount: positiveCents('an amount'),
});

export const expenseInputSchema = z.object({
  companyId: id('a company'),
  title: requiredText('a title'),
  payeeId: id('a payee'),
  expenseDate: ymd('the expense date'),
  dueDate: optionalYmd,
  items: z.array(expenseItemSchema).min(1, 'Add at least one line').max(100, 'Keep to 100 lines or fewer'),
  notes: text(2000),
  attachmentIds: fileIds,
});
export type ExpenseInput = z.output<typeof expenseInputSchema>;

const claimItemSchema = z.object({
  date: ymd('the date on the receipt'),
  description: requiredText('a description', 300),
  categoryId: id('a category'),
  amount: positiveCents('an amount'),
  receiptFileId: optionalId,
});

export const claimInputSchema = z.object({
  companyId: id('a company'),
  title: requiredText('a title'),
  items: z.array(claimItemSchema).min(1, 'Add at least one line').max(100, 'Keep to 100 lines or fewer'),
  notes: text(2000),
});
export type ClaimInput = z.output<typeof claimInputSchema>;

export const payInputSchema = z.object({
  paidDate: ymd('the date it was paid'),
  reference: text(100),
});
export type PayInput = z.output<typeof payInputSchema>;

export const staffInputSchema = z.object({
  companyId: id('a company'),
  name: requiredText('the staff member’s name'),
  monthlySalary: positiveCents('a monthly salary'),
  notes: text(1000),
  active: z.boolean().default(true),
  ...payoutDetails,
});
export type StaffInput = z.output<typeof staffInputSchema>;

export const salaryRunCreateSchema = z.object({
  companyId: id('a company'),
  month,
});
export type SalaryRunCreateInput = z.output<typeof salaryRunCreateSchema>;

export const salaryRunUpdateSchema = z.object({
  lines: z
    .array(
      z.object({
        staffId: id('a staff member'),
        amount: cents('an amount'),
        note: text(200),
      }),
    )
    .min(1, 'A salary run needs at least one staff member')
    .max(500),
  notes: text(2000),
});
export type SalaryRunUpdateInput = z.output<typeof salaryRunUpdateSchema>;

export const otherIncomeInputSchema = z.object({
  companyId: id('a company'),
  date: ymd('the date received'),
  description: requiredText('a description', 300),
  categoryId: id('a category'),
  amount: positiveCents('an amount'),
  notes: text(1000),
});
export type OtherIncomeInput = z.output<typeof otherIncomeInputSchema>;

// ── Recurring ───────────────────────────────────────────────────────────────

export const RECURRING_KINDS = ['invoice', 'expense'] as const;
export type RecurringKind = (typeof RECURRING_KINDS)[number];

const wholeNumber = (what: string, min: number, max: number) =>
  z
    .number({ required_error: `Enter ${what}`, invalid_type_error: `Enter ${what}` })
    .int('Enter a whole number')
    .min(min, `Enter ${min} or more`)
    .max(max, `Enter ${max} or less`);

export const recurringInputSchema = z
  .object({
    kind: z.enum(RECURRING_KINDS, { errorMap: () => ({ message: 'Choose invoice or expense' }) }),
    name: requiredText('a name'),
    companyId: id('a company'),
    clientId: optionalId,
    payeeId: optionalId,
    categoryId: optionalId,
    description: text(500),
    amount: positiveCents('an amount'),
    frequency: z.enum(FREQUENCIES, { errorMap: () => ({ message: 'Choose how often' }) }),
    startDate: ymd('a start date'),
    endDate: optionalYmd,
    dayOfMonth: wholeNumber('a day of the month', 1, 28),
    remindDaysBefore: wholeNumber('a number of days', 0, 60).default(7),
    paymentTermsDays: wholeNumber('a number of days', 0, 365).default(14),
    active: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'invoice' && !value.clientId) {
      ctx.addIssue({ code: 'custom', path: ['clientId'], message: 'Choose a client' });
    }
    if (value.kind === 'expense') {
      if (!value.payeeId) ctx.addIssue({ code: 'custom', path: ['payeeId'], message: 'Choose a payee' });
      if (!value.categoryId) ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Choose a category' });
    }
    if (value.endDate && value.endDate < value.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'This is before the start date' });
    }
  });
export type RecurringInput = z.output<typeof recurringInputSchema>;

export const recurringPeriodSchema = z.object({
  period: ymd('a period'),
});

// ── Validation result shared by server and web ──────────────────────────────

export type FieldErrors = Record<string, string>;

export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; fields: FieldErrors };

export function validate<S extends z.ZodTypeAny>(schema: S, input: unknown): ParseResult<z.output<S>> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, fields: fieldErrorsOf(parsed.error) };
}
