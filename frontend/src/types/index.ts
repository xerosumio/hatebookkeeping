export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  mustChangePassword: boolean;
  bankName?: string;
  bankAccountNumber?: string;
  fpsPhone?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Client {
  _id: string;
  name: string;
  entity?: string | Entity;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  waived?: boolean;
}

export interface PaymentMilestone {
  milestone: string;
  percentage: number;
  amount: number;
  dueDescription: string;
}

export interface Entity {
  _id: string;
  code: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  bankAccounts: BankAccount[];
  brandColor: string;
  companyChopUrl: string;
  signatureUrl: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShareAdjustmentLog {
  previousPercent: number;
  newPercent: number;
  date: string;
  reason: string;
  changedBy: string | { _id: string; name: string };
}

export interface Shareholder {
  _id: string;
  user: string | { _id: string; name: string; email: string; role: string };
  name: string;
  sharePercent: number;
  active: boolean;
  shareHistory?: ShareAdjustmentLog[];
  currentEquity?: number;
  totalInvested?: number;
  createdAt: string;
  updatedAt: string;
}

export interface EquityTransaction {
  _id: string;
  type: 'investment' | 'distribution' | 'collection' | 'adjustment';
  shareholder: string | Shareholder;
  amount: number;
  date: string;
  description: string;
  monthlyClose?: string;
  balanceAfter: number;
  createdBy: string | { _id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyCloseDistribution {
  shareholder: string | { _id: string; name: string; sharePercent: number };
  sharePercent: number;
  amount: number;
  equityTransaction?: string;
}

export interface MonthlyClose {
  _id?: string;
  entity: string | Entity;
  year: number;
  month: number;
  status: 'draft' | 'finalized';
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  shareholderDistribution: number;
  companyReserve: number;
  staffReserve: number;
  distributions: MonthlyCloseDistribution[];
  isLoss: boolean;
  closedBy?: string | { _id: string; name: string };
  closedAt?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Fund {
  _id: string;
  name: string;
  type: 'reserve' | 'bank' | 'petty_cash';
  entity?: string | Entity;
  heldIn?: string | { _id: string; name: string; type: string };
  balance: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FundTransfer {
  _id: string;
  fromFund?: string | { _id: string; name: string; type: string };
  toFund?: string | { _id: string; name: string; type: string };
  amount: number;
  date: string;
  description: string;
  reference?: string;
  createdBy: string | { _id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface QuotationActivityLog {
  action: 'created' | 'updated' | 'pending_approval' | 'approved' | 'rejected' | 'sent' | 'accepted' | 'client_rejected' | 'notified';
  user: string | { _id: string; name: string };
  timestamp: string;
  note?: string;
}

export interface Quotation {
  _id: string;
  quotationNumber: string;
  entity: string | Entity;
  client: string | Client;
  status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'accepted' | 'rejected';
  title: string;
  lineItems: LineItem[];
  subtotal: number;
  discount: number;
  discountPercent: number;
  total: number;
  termsAndConditions: string;
  paymentSchedule: PaymentMilestone[];
  companyChopUrl: string;
  signatureUrl: string;
  validUntil: string;
  notes: string;
  approvedBy?: string | User;
  approvedAt?: string;
  rejectionReason?: string;
  notifiedEmails?: string[];
  activityLog?: QuotationActivityLog[];
  createdBy: string | User;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  entity: string | Entity;
  quotation?: string | { _id: string; quotationNumber: string; title: string };
  client: string | Client;
  status: 'unpaid' | 'partial' | 'paid';
  lineItems: LineItem[];
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  milestone: string;
  paymentTerms: string;
  dueDate: string;
  notes: string;
  bankAccountInfo: string;
  companyChopUrl: string;
  signatureUrl: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  _id: string;
  receiptNumber: string;
  entity?: string | Entity;
  invoice: string | Invoice;
  client: string | Client;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  bankReference: string;
  bankAccount: string;
  notes: string;
  companyChopUrl: string;
  signatureUrl: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  _id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  entity?: string | Entity;
  payee?: string | { _id: string; name: string };
  invoice?: string | { _id: string; invoiceNumber: string; client?: string | { _id: string; name: string } };
  receipt?: string;
  paymentRequest?: string | { _id: string; requestNumber: string; items?: Array<{ payee?: string | { _id: string; name: string }; description?: string; amount?: number; category?: string }> };
  bankReference: string;
  bankAccount: string;
  reconciled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payee {
  _id: string;
  name: string;
  entity?: string | Entity;
  bankName: string;
  bankAccountNumber: string;
  bankCode: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRequestItem {
  payee: string | Payee;
  description: string;
  amount: number;
  category: string;
  recipient?: string;
}

export interface ActivityLogEntry {
  action: 'created' | 'updated' | 'approved' | 'rejected' | 'executed' | 'notified';
  user: string | { _id: string; name: string };
  timestamp: string;
  note?: string;
}

export interface PaymentRequest {
  _id: string;
  requestNumber: string;
  entity?: string | Entity;
  description: string;
  items: PaymentRequestItem[];
  totalAmount: number;
  sourceBankAccount: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  createdBy: string | User;
  approvedBy?: string | User;
  approvedAt?: string;
  rejectionReason?: string;
  executedAt?: string;
  bankReference?: string;
  attachments: string[];
  notifiedEmails?: string[];
  activityLog?: ActivityLogEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface BankAccount {
  name: string;
  bankName: string;
  accountNumber: string;
}

export interface ChartOfAccount {
  code: string;
  name: string;
  type: 'income' | 'expense';
  active: boolean;
}

export interface Settings {
  _id: string;
  defaultEntityId?: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  logoUrl: string;
  bankAccountInfo: string;
  bankAccounts: BankAccount[];
  chartOfAccounts: ChartOfAccount[];
  companyChopUrl: string;
  signatureUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface CashFlowMonth {
  month: number;
  income: number;
  expense: number;
  net: number;
}

export interface CashFlowReport {
  year: number;
  months: CashFlowMonth[];
  totals: { income: number; expense: number; net: number };
}

export interface ARInvoice {
  _id: string;
  invoiceNumber: string;
  client: { _id: string; name: string } | string;
  total: number;
  amountPaid: number;
  amountDue: number;
  status: string;
  dueDate?: string;
  createdAt: string;
}

export interface AccountsReceivableReport {
  invoices: ARInvoice[];
  summary: {
    totalDue: number;
    count: number;
    overdueCount: number;
    overdueDue: number;
  };
}

export interface IncomeStatementLine {
  category: string;
  total: number;
  count: number;
}

export interface IncomeStatementReport {
  period: { startDate: string; endDate: string };
  income: IncomeStatementLine[];
  expenses: IncomeStatementLine[];
  totals: { income: number; expense: number; net: number };
}

export interface APPaymentRequest {
  _id: string;
  requestNumber: string;
  description: string;
  items: Array<{
    payee: { _id: string; name: string } | string;
    description: string;
    amount: number;
    category: string;
  }>;
  totalAmount: number;
  status: 'pending' | 'approved';
  createdBy: { _id: string; name: string } | string;
  createdAt: string;
}

export interface APCategoryBreakdown {
  category: string;
  total: number;
}

export interface AccountsPayableReport {
  requests: APPaymentRequest[];
  summary: {
    totalAmount: number;
    count: number;
    pendingAmount: number;
    pendingCount: number;
    approvedAmount: number;
    approvedCount: number;
  };
  categoryBreakdown: APCategoryBreakdown[];
}

export interface RecurringHistoryEntry {
  date: string;
  action: 'generated_invoice' | 'generated_payment_request' | 'alert_sent';
  referenceId?: string;
  referenceModel?: 'Invoice' | 'PaymentRequest';
  note?: string;
}

export interface RecurringItem {
  _id: string;
  name: string;
  entity?: string | Entity;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  client?: string | { _id: string; name: string };
  payee?: string | { _id: string; name: string };
  description: string;
  startDate?: string;
  endDate?: string;
  active: boolean;
  dueDay: number;
  alertDaysBefore: number;
  paymentTerms?: string;
  bankAccountInfo?: string;
  lastGeneratedDate?: string;
  lastGeneratedInvoice?: string;
  lastGeneratedPaymentRequest?: string;
  history: RecurringHistoryEntry[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReimbursementItem {
  date: string;
  description: string;
  amount: number;
  category: string;
  receiptUrl: string;
  notes: string;
}

export interface Reimbursement {
  _id: string;
  reimbursementNumber: string;
  title: string;
  submittedBy: string | { _id: string; name: string; email: string; bankName?: string; bankAccountNumber?: string; fpsPhone?: string };
  items: ReimbursementItem[];
  totalAmount: number;
  paymentRequest?: string | PaymentRequest;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
