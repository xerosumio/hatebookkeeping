import type { Types } from 'mongoose';
import {
  can,
  computeTotals,
  hkToday,
  type DiscountType,
  type InvoiceAction,
  type InvoiceDto,
  type LineItemValues,
  type PaymentDto,
} from '@hbk/shared';
import { activityDto, activityEntry, type Actor } from '../../platform/activity.js';
import { lineItemDto } from '../../platform/lines.js';
import { countLabel, namesOf, refOf, registerReference } from '../../platform/references.js';
import { Client } from '../clients/model.js';
import { Company } from '../companies/model.js';
import type { UserDoc } from '../users/model.js';
import { Invoice, Payment, type InvoiceDoc, type PaymentDoc } from './model.js';

registerReference('client', async (id) => countLabel(await Invoice.countDocuments({ clientId: id }), 'invoice'));

export interface InvoiceContent {
  companyId: Types.ObjectId | string;
  clientId: Types.ObjectId | string;
  title: string;
  issueDate: string;
  dueDate: string | null;
  lineItems: readonly LineItemValues[];
  discountType: DiscountType;
  discountValue: number;
  notes: string;
  bankDetails: string | null;
}

/** The stored fields for an invoice's content. Totals always come from here, never from the browser. */
export function invoiceFields(content: InvoiceContent) {
  const totals = computeTotals(content.lineItems, content.discountType, content.discountValue);
  return {
    companyId: content.companyId,
    clientId: content.clientId,
    title: content.title,
    issueDate: content.issueDate,
    dueDate: content.dueDate,
    lineItems: totals.lineItems,
    discountType: content.discountType,
    discountValue: content.discountValue,
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    notes: content.notes,
    bankDetails: content.bankDetails,
  };
}

export interface InvoiceOrigin {
  quoteId?: Types.ObjectId;
  quoteNumber?: string;
  milestoneId?: Types.ObjectId | null;
  milestoneLabel?: string;
  quoteSlot?: string;
  recurringSlot?: string;
}

/** Creates a draft invoice. A duplicate `quoteSlot` or `recurringSlot` is refused by the database. */
export async function createDraftInvoice(content: InvoiceContent, actor: Actor, note: string, origin: InvoiceOrigin = {}): Promise<InvoiceDoc> {
  return Invoice.create({
    ...invoiceFields(content),
    ...origin,
    status: 'draft',
    amountPaid: 0,
    activity: [activityEntry(actor, 'Created', note)],
    createdById: actor._id,
    createdByName: actor.name,
  });
}

export const isOverdue = (invoice: Pick<InvoiceDoc, 'status' | 'dueDate'>, today = hkToday()) =>
  (invoice.status === 'unpaid' || invoice.status === 'partial') && invoice.dueDate !== null && invoice.dueDate < today;

function actionsFor(invoice: InvoiceDoc, user: UserDoc): InvoiceAction[] {
  const actions: InvoiceAction[] = [];
  const manage = can(user.role, 'invoices.manage');
  if (invoice.status === 'draft' && manage) actions.push('edit', 'delete', 'issue');
  if ((invoice.status === 'unpaid' || invoice.status === 'partial') && manage) actions.push('edit');
  if (invoice.status === 'unpaid' && invoice.amountPaid === 0 && manage) actions.push('cancel');
  if ((invoice.status === 'unpaid' || invoice.status === 'partial') && can(user.role, 'payments.record')) actions.push('recordPayment');
  return actions;
}

interface Names {
  companies: Map<string, string>;
  clients: Map<string, string>;
}

export function paymentDto(payment: PaymentDoc, invoiceNumber: string, names: Names, user: UserDoc): PaymentDto {
  return {
    id: String(payment._id),
    number: payment.number,
    invoice: { id: String(payment.invoiceId), number: invoiceNumber },
    company: refOf(names.companies, payment.companyId),
    client: refOf(names.clients, payment.clientId),
    amount: payment.amount,
    date: payment.date,
    method: payment.method,
    reference: payment.reference,
    notes: payment.notes,
    voided: payment.voided,
    voidReason: payment.voidReason,
    canVoid: !payment.voided && can(user.role, 'payments.void'),
    createdAt: payment.createdAt.toISOString(),
  };
}

function toDto(invoice: InvoiceDoc, payments: PaymentDoc[], names: Names, bankDetails: string, user: UserDoc, withHistory: boolean): InvoiceDto {
  return {
    id: String(invoice._id),
    number: invoice.number,
    status: invoice.status,
    overdue: isOverdue(invoice),
    company: refOf(names.companies, invoice.companyId),
    client: refOf(names.clients, invoice.clientId),
    title: invoice.title,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    lineItems: invoice.lineItems.map(lineItemDto),
    discountType: invoice.discountType,
    discountValue: invoice.discountValue,
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    amountDue: invoice.status === 'cancelled' ? 0 : invoice.total - invoice.amountPaid,
    notes: invoice.notes,
    bankDetails,
    ownBankDetails: invoice.bankDetails !== null,
    quote: invoice.quoteId ? { id: String(invoice.quoteId), number: invoice.quoteNumber } : null,
    milestoneLabel: invoice.milestoneLabel,
    payments: payments.map((payment) => paymentDto(payment, invoice.number, names, user)),
    activity: withHistory ? invoice.activity.map(activityDto) : [],
    actions: actionsFor(invoice, user),
    createdBy: { id: String(invoice.createdById), name: invoice.createdByName },
    createdAt: invoice.createdAt.toISOString(),
  };
}

/** One invoice with its payments and history. */
export async function invoiceDto(invoice: InvoiceDoc, user: UserDoc): Promise<InvoiceDto> {
  const [payments, company, clients] = await Promise.all([
    Payment.find({ invoiceId: invoice._id }).sort({ date: 1, createdAt: 1 }),
    Company.findById(invoice.companyId).select('name bankDetails'),
    namesOf(Client, [invoice.clientId]),
  ]);
  const names: Names = { companies: new Map(company ? [[String(company._id), company.name]] : []), clients };
  return toDto(invoice, payments, names, invoice.bankDetails ?? company?.bankDetails ?? '', user, true);
}

/** Many invoices for a list: payments included, history left out. */
export async function invoiceDtos(invoices: InvoiceDoc[], user: UserDoc): Promise<InvoiceDto[]> {
  const [payments, companies, clients] = await Promise.all([
    Payment.find({ invoiceId: { $in: invoices.map((invoice) => invoice._id) } }).sort({ date: 1, createdAt: 1 }),
    Company.find().select('name bankDetails'),
    namesOf(Client, invoices.map((invoice) => invoice.clientId)),
  ]);
  const names: Names = { companies: new Map(companies.map((company) => [String(company._id), company.name])), clients };
  const bank = new Map(companies.map((company) => [String(company._id), company.bankDetails]));
  const byInvoice = new Map<string, PaymentDoc[]>();
  for (const payment of payments) {
    const key = String(payment.invoiceId);
    byInvoice.set(key, [...(byInvoice.get(key) ?? []), payment]);
  }
  return invoices.map((invoice) =>
    toDto(invoice, byInvoice.get(String(invoice._id)) ?? [], names, invoice.bankDetails ?? bank.get(String(invoice.companyId)) ?? '', user, false),
  );
}
