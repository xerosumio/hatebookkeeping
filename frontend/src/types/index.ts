export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'maker' | 'checker';
  mustChangePassword: boolean;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Client {
  _id: string;
  name: string;
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
}

export interface PaymentMilestone {
  milestone: string;
  percentage: number;
  amount: number;
  dueDescription: string;
}

export interface Quotation {
  _id: string;
  quotationNumber: string;
  client: string | Client;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  title: string;
  lineItems: LineItem[];
  subtotal: number;
  discount: number;
  total: number;
  termsAndConditions: string;
  paymentSchedule: PaymentMilestone[];
  companyChopUrl: string;
  signatureUrl: string;
  validUntil: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  quotation?: string;
  client: string | Client;
  status: 'unpaid' | 'partial' | 'paid';
  lineItems: LineItem[];
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  milestone: string;
  dueDate: string;
  notes: string;
  companyChopUrl: string;
  signatureUrl: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  _id: string;
  receiptNumber: string;
  invoice: string | Invoice;
  client: string | Client;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  bankReference: string;
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
  invoice?: string;
  receipt?: string;
  paymentRequest?: string;
  bankReference: string;
  bankAccount: string;
  reconciled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRequest {
  _id: string;
  requestNumber: string;
  type: 'salary' | 'reimbursement' | 'vendor_payment' | 'other';
  payee: string;
  description: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  createdBy: string | User;
  approvedBy?: string | User;
  approvedAt?: string;
  rejectionReason?: string;
  executedAt?: string;
  bankReference?: string;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RecurringItem {
  _id: string;
  name: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  client?: string;
  description: string;
  startDate: string;
  endDate?: string;
  active: boolean;
  lastGeneratedDate?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
