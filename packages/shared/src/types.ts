import type { Permission, Role } from './permissions.js';
import type { Frequency, RecurringState } from './recurring.js';
import type { CategoryType, FieldErrors, PaymentMethod, RecurringKind } from './schemas.js';
import type { DiscountType } from './totals.js';

/** What the API returns. The server builds these; the web app only reads them. */

export interface Ref {
  id: string;
  name: string;
}

export interface ApiErrorBody {
  error: string;
  fields?: FieldErrors;
}

// ── People and setup ────────────────────────────────────────────────────────

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  isApprover: boolean;
  bankName: string;
  bankAccountNumber: string;
  fpsId: string;
  lastSignInAt: string | null;
}

export interface MeDto extends UserDto {
  permissions: Permission[];
}

export interface CompanyDto {
  id: string;
  code: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  brandColor: string;
  bankDetails: string;
  quoteTerms: string;
  logoFileId: string | null;
  chopFileId: string | null;
  signatureFileId: string | null;
  active: boolean;
}

/** The number the next quote, invoice and receipt of this year will get. */
export interface NumberingDto {
  year: number;
  quote: number;
  invoice: number;
  receipt: number;
}

export type SystemCategory = 'sales' | 'salary';

export interface CategoryDto {
  id: string;
  name: string;
  type: CategoryType;
  active: boolean;
  /** Categories the app itself books to. They can be renamed but not removed. */
  system: SystemCategory | null;
}

export interface ApprovalSettingsDto {
  approverIds: string[];
  approvalsRequired: number;
}

export interface ClientDto {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  archived: boolean;
}

export interface PayeeDto {
  id: string;
  name: string;
  bankName: string;
  bankAccountNumber: string;
  bankCode: string;
  fpsId: string;
  notes: string;
  archived: boolean;
}

export interface FileDto {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}

// ── Shared document parts ───────────────────────────────────────────────────

export interface ActivityDto {
  at: string;
  userName: string;
  action: string;
  note: string;
}

export interface ApprovalDto {
  userId: string;
  userName: string;
  at: string;
}

export interface LineItemDto {
  description: string;
  quantity: number;
  unitPrice: number;
  waived: boolean;
  amount: number;
}

// ── Quotes ──────────────────────────────────────────────────────────────────

export const QUOTE_STATUSES = ['draft', 'pending_approval', 'approved', 'sent', 'accepted', 'declined'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export type QuoteAction =
  | 'edit'
  | 'delete'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'revise'
  | 'send'
  | 'accept'
  | 'decline'
  | 'convert';

export interface MilestoneDto {
  id: string;
  label: string;
  percentage: number;
  dueDescription: string;
  amount: number;
  invoice: { id: string; number: string } | null;
}

export interface QuoteDto {
  id: string;
  number: string;
  status: QuoteStatus;
  company: Ref;
  client: Ref;
  title: string;
  issueDate: string;
  validUntil: string | null;
  lineItems: LineItemDto[];
  discountType: DiscountType;
  discountValue: number;
  subtotal: number;
  discount: number;
  total: number;
  paymentSchedule: MilestoneDto[];
  /** Set when the quote has no payment schedule and has been invoiced in full. */
  invoice: { id: string; number: string } | null;
  terms: string;
  notes: string;
  approvals: ApprovalDto[];
  approvalsRequired: number;
  rejectionReason: string;
  activity: ActivityDto[];
  actions: QuoteAction[];
  createdBy: Ref;
  createdAt: string;
}

// ── Invoices and payments ───────────────────────────────────────────────────

export const INVOICE_STATUSES = ['draft', 'unpaid', 'partial', 'paid', 'cancelled'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type InvoiceAction = 'edit' | 'delete' | 'issue' | 'cancel' | 'recordPayment';

export interface PaymentDto {
  id: string;
  number: string;
  invoice: { id: string; number: string };
  company: Ref;
  client: Ref;
  amount: number;
  date: string;
  method: PaymentMethod;
  reference: string;
  notes: string;
  voided: boolean;
  voidReason: string;
  canVoid: boolean;
  createdAt: string;
}

export interface InvoiceDto {
  id: string;
  number: string;
  status: InvoiceStatus;
  overdue: boolean;
  company: Ref;
  client: Ref;
  title: string;
  issueDate: string;
  dueDate: string | null;
  lineItems: LineItemDto[];
  discountType: DiscountType;
  discountValue: number;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  notes: string;
  /** What is printed: the invoice's own bank details, or the company's. */
  bankDetails: string;
  /** True when this invoice carries its own bank details instead of the company's. */
  ownBankDetails: boolean;
  quote: { id: string; number: string } | null;
  milestoneLabel: string;
  payments: PaymentDto[];
  activity: ActivityDto[];
  actions: InvoiceAction[];
  createdBy: Ref;
  createdAt: string;
}

// ── Expenses, claims, salary ────────────────────────────────────────────────

export const EXPENSE_KINDS = ['expense', 'claim', 'salary'] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export const EXPENSE_STATUSES = ['draft', 'pending_approval', 'approved', 'paid', 'reversed'] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export type ExpenseAction =
  | 'edit'
  | 'delete'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'withdraw'
  | 'pay'
  | 'reverse';

export interface ExpenseItemDto {
  description: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  /** The day this line counts on in "Billed / committed". */
  date: string;
  receiptFileId: string | null;
  staffId: string | null;
  note: string;
}

export interface ExpenseDto {
  id: string;
  number: string;
  kind: ExpenseKind;
  status: ExpenseStatus;
  company: Ref;
  title: string;
  payee: Ref | null;
  claimant: Ref | null;
  salaryMonth: string | null;
  expenseDate: string;
  dueDate: string | null;
  items: ExpenseItemDto[];
  total: number;
  notes: string;
  attachmentIds: string[];
  approvals: ApprovalDto[];
  approvalsRequired: number;
  rejectionReason: string;
  paidDate: string | null;
  paymentReference: string;
  reversalReason: string;
  activity: ActivityDto[];
  actions: ExpenseAction[];
  createdBy: Ref;
  createdAt: string;
}

export interface StaffDto {
  id: string;
  company: Ref;
  name: string;
  monthlySalary: number;
  bankName: string;
  bankAccountNumber: string;
  fpsId: string;
  notes: string;
  active: boolean;
}

export interface OtherIncomeDto {
  id: string;
  company: Ref;
  date: string;
  description: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  notes: string;
}

// ── Recurring ───────────────────────────────────────────────────────────────

export interface RecurringHistoryDto {
  period: string;
  action: 'generated' | 'skipped';
  at: string;
  userName: string;
  document: { kind: RecurringKind; id: string; number: string } | null;
}

export interface ReminderDto {
  period: string;
  at: string;
  status: EmailStatus;
  detail: string;
}

export interface RecurringDto {
  id: string;
  kind: RecurringKind;
  name: string;
  company: Ref;
  client: Ref | null;
  payee: Ref | null;
  categoryId: string | null;
  categoryName: string;
  description: string;
  amount: number;
  frequency: Frequency;
  startDate: string;
  endDate: string | null;
  dayOfMonth: number;
  remindDaysBefore: number;
  paymentTermsDays: number;
  active: boolean;
  state: RecurringState;
  pending: string[];
  nextDue: string | null;
  history: RecurringHistoryDto[];
  lastReminder: ReminderDto | null;
}

export interface GenerateResultDto {
  itemId: string;
  name: string;
  period: string | null;
  ok: boolean;
  message: string;
  document: { kind: RecurringKind; id: string; number: string } | null;
}

// ── Email ───────────────────────────────────────────────────────────────────

export type EmailStatus = 'sent' | 'failed' | 'not_configured';

// ── Reports ─────────────────────────────────────────────────────────────────

export type PnlBasis = 'cash' | 'billed';

export const PNL_BASIS_LABELS: Record<PnlBasis, string> = {
  cash: 'Cash in / out',
  billed: 'Billed / committed',
};

export interface PnlLineDto {
  categoryId: string;
  name: string;
  amount: number;
}

export interface PnlSideDto {
  income: PnlLineDto[];
  expenses: PnlLineDto[];
  totalIncome: number;
  totalExpenses: number;
  net: number;
}

export interface PnlMonthDto {
  month: string;
  companyId: string | null;
  cash: PnlSideDto;
  billed: PnlSideDto;
}

export interface PnlTotalsDto {
  income: number;
  expenses: number;
  net: number;
}

export interface PnlYearDto {
  year: number;
  companyId: string | null;
  months: { month: string; cash: PnlTotalsDto; billed: PnlTotalsDto }[];
  cash: PnlTotalsDto;
  billed: PnlTotalsDto;
}

export type PnlEntrySource = 'invoice' | 'payment' | 'expense' | 'claim' | 'salary' | 'other_income';

export interface PnlEntryDto {
  source: PnlEntrySource;
  /** The record to open: an invoice, expense, claim, salary run or other-income entry. */
  documentId: string;
  number: string;
  date: string;
  description: string;
  counterparty: string;
  amount: number;
}

export interface DashboardDto {
  month: string;
  cash: PnlTotalsDto;
  billed: PnlTotalsDto;
  unpaidInvoices: {
    count: number;
    total: number;
    overdueCount: number;
    overdueTotal: number;
    items: { id: string; number: string; clientName: string; dueDate: string | null; amountDue: number; overdue: boolean }[];
  };
  waitingForApproval: { kind: 'quote' | ExpenseKind; id: string; number: string; title: string; total: number; mine: boolean }[];
  waitingForPayment: { kind: ExpenseKind; id: string; number: string; title: string; total: number; dueDate: string | null }[];
  recurringDue: { id: string; name: string; state: RecurringState; period: string }[];
  setup: { hasCompany: boolean; hasApprovers: boolean };
}
