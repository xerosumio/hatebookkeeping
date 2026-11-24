/**
 * What the PDF templates print. Everything is already formatted or resolved:
 * the templates do no lookups and no arithmetic.
 */

export interface PdfCompany {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  brandColor: string;
  /** Data URIs, or '' when the company has not uploaded one. */
  logo: string;
  chop: string;
  signature: string;
}

export interface PdfParty {
  name: string;
  contactPerson: string;
  email: string;
  address: string;
}

export interface PdfLine {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  waived: boolean;
}

export interface QuotePdfData {
  number: string;
  /** Printed on the page until the quote is approved. */
  draft: boolean;
  title: string;
  issueDate: string;
  validUntil: string;
  client: PdfParty;
  lines: PdfLine[];
  subtotal: number;
  discount: number;
  discountPercent: number | null;
  total: number;
  schedule: { label: string; percentage: number; amount: number; dueDescription: string }[];
  notes: string;
  terms: string;
}

export interface InvoicePdfData {
  number: string;
  /** 'DRAFT' or 'CANCELLED', or '' for an issued invoice. */
  watermark: string;
  title: string;
  issueDate: string;
  dueDate: string;
  milestoneLabel: string;
  quoteNumber: string;
  client: PdfParty;
  lines: PdfLine[];
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  bankDetails: string;
  notes: string;
}

export interface ReceiptPdfData {
  number: string;
  voided: boolean;
  date: string;
  method: string;
  reference: string;
  client: PdfParty;
  invoiceNumber: string;
  invoiceTitle: string;
  milestoneLabel: string;
  quoteNumber: string;
  invoiceTotal: number;
  balanceDue: number;
  amount: number;
  notes: string;
}
