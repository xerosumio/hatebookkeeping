import { Router } from 'express';
import { Types } from 'mongoose';
import React from 'react';
import {
  QUOTE_STATUSES,
  can,
  computeTotals,
  convertQuoteSchema,
  formatDate,
  formatMoney,
  hkToday,
  milestoneAmounts,
  quoteInputSchema,
  reasonSchema,
  type QuoteAction,
  type QuoteDto,
  type QuoteInput,
  type QuoteStatus,
} from '@hbk/shared';
import { QuotePDF } from '../../integrations/pdf/QuotePDF.js';
import { renderPdf, sendPdf } from '../../integrations/pdf/render.js';
import { activityDto, activityEntry, approvalDto, record } from '../../platform/activity.js';
import { currentUser, requirePermission } from '../../platform/auth.js';
import { conflict, notFound, validationError } from '../../platform/errors.js';
import { objectId, parse, queryString, route } from '../../platform/http.js';
import { lineItemDto } from '../../platform/lines.js';
import { countLabel, namesOf, refOf, registerReference } from '../../platform/references.js';
import { approvalBlocker, approvalEntry, approversToAsk, assertCanReachApproval, assertMayApprove, isFullyApproved, notify } from '../approval.js';
import { Client } from '../clients/model.js';
import { clientForInput } from '../clients/routes.js';
import { Company } from '../companies/model.js';
import { companyForInput, nextCustomerNumber, pdfCompany } from '../companies/service.js';
import { Invoice } from '../invoices/model.js';
import { createDraftInvoice, invoiceDto } from '../invoices/service.js';
import { approvalPolicy, type ApprovalPolicy } from '../settings/service.js';
import type { UserDoc } from '../users/model.js';
import { Quote, type QuoteDoc } from './model.js';

registerReference('client', async (id) => countLabel(await Quote.countDocuments({ clientId: id }), 'quote'));

const router = Router();

async function load(id: unknown): Promise<QuoteDoc> {
  const quote = await Quote.findById(objectId(id, 'That quote'));
  if (!quote) throw notFound('That quote');
  return quote;
}

function contentOf(input: QuoteInput) {
  const totals = computeTotals(input.lineItems, input.discountType, input.discountValue);
  const amounts = milestoneAmounts(
    totals.total,
    input.paymentSchedule.map((milestone) => milestone.percentage),
  );
  return {
    clientId: input.clientId,
    title: input.title,
    issueDate: input.issueDate,
    validUntil: input.validUntil,
    lineItems: totals.lineItems,
    discountType: input.discountType,
    discountValue: input.discountValue,
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    paymentSchedule: input.paymentSchedule.map((milestone, index) => ({ ...milestone, amount: amounts[index]! })),
    terms: input.terms,
    notes: input.notes,
  };
}

// ── What the reader sees ────────────────────────────────────────────────────

interface LinkedInvoice {
  id: string;
  number: string;
  milestoneId: string | null;
}

async function linkedInvoices(quoteIds: unknown[]): Promise<Map<string, LinkedInvoice[]>> {
  // Cancelled invoices no longer stand for the quote, so they are left out.
  const invoices = await Invoice.find({ quoteId: { $in: quoteIds }, status: { $ne: 'cancelled' } }).select('number quoteId milestoneId');
  const byQuote = new Map<string, LinkedInvoice[]>();
  for (const invoice of invoices) {
    const key = String(invoice.quoteId);
    byQuote.set(key, [
      ...(byQuote.get(key) ?? []),
      { id: String(invoice._id), number: invoice.number || 'Draft', milestoneId: invoice.milestoneId ? String(invoice.milestoneId) : null },
    ]);
  }
  return byQuote;
}

function actionsFor(quote: QuoteDoc, invoices: LinkedInvoice[], user: UserDoc, policy: ApprovalPolicy): QuoteAction[] {
  const manage = can(user.role, 'quotes.manage');
  const actions: QuoteAction[] = [];
  switch (quote.status) {
    case 'draft':
      if (manage) actions.push('edit', 'delete', 'submit');
      break;
    case 'pending_approval':
      if (approvalBlocker(policy, user, quote.authorIds.map(String), quote.approvals) === null) actions.push('approve', 'reject');
      if (manage) actions.push('revise');
      break;
    case 'approved':
      if (manage) actions.push('send', 'revise');
      break;
    case 'sent':
      if (manage) actions.push('accept', 'decline', 'revise');
      break;
    case 'declined':
      if (manage) actions.push('revise');
      break;
    case 'accepted': {
      const slots = quote.paymentSchedule.length || 1;
      if (can(user.role, 'invoices.manage') && invoices.length < slots && quote.total > 0) actions.push('convert');
      if (manage && invoices.length === 0) actions.push('revise');
      break;
    }
  }
  return actions;
}

interface Context {
  companies: Map<string, string>;
  clients: Map<string, string>;
  invoices: Map<string, LinkedInvoice[]>;
  policy: ApprovalPolicy;
  user: UserDoc;
}

async function contextFor(quotes: QuoteDoc[], user: UserDoc): Promise<Context> {
  const [companies, clients, invoices, policy] = await Promise.all([
    namesOf(Company, quotes.map((quote) => quote.companyId)),
    namesOf(Client, quotes.map((quote) => quote.clientId)),
    linkedInvoices(quotes.map((quote) => quote._id)),
    approvalPolicy(),
  ]);
  return { companies, clients, invoices, policy, user };
}

function toDto(quote: QuoteDoc, context: Context, withHistory: boolean): QuoteDto {
  const invoices = context.invoices.get(String(quote._id)) ?? [];
  const invoiceFor = (milestoneId: string | null) => {
    const invoice = invoices.find((candidate) => candidate.milestoneId === milestoneId);
    return invoice ? { id: invoice.id, number: invoice.number } : null;
  };
  return {
    id: String(quote._id),
    number: quote.number,
    status: quote.status,
    company: refOf(context.companies, quote.companyId),
    client: refOf(context.clients, quote.clientId),
    title: quote.title,
    issueDate: quote.issueDate,
    validUntil: quote.validUntil,
    lineItems: quote.lineItems.map(lineItemDto),
    discountType: quote.discountType,
    discountValue: quote.discountValue,
    subtotal: quote.subtotal,
    discount: quote.discount,
    total: quote.total,
    paymentSchedule: quote.paymentSchedule.map((milestone) => ({
      id: String(milestone._id),
      label: milestone.label,
      percentage: milestone.percentage,
      dueDescription: milestone.dueDescription,
      amount: milestone.amount,
      invoice: invoiceFor(String(milestone._id)),
    })),
    invoice: quote.paymentSchedule.length === 0 ? invoiceFor(null) : null,
    terms: quote.terms,
    notes: quote.notes,
    approvals: quote.approvals.map(approvalDto),
    approvalsRequired: context.policy.required,
    rejectionReason: quote.rejectionReason,
    activity: withHistory ? quote.activity.map(activityDto) : [],
    actions: actionsFor(quote, invoices, context.user, context.policy),
    createdBy: { id: String(quote.createdById), name: quote.createdByName },
    createdAt: quote.createdAt.toISOString(),
  };
}

async function one(quote: QuoteDoc, user: UserDoc): Promise<QuoteDto> {
  return toDto(quote, await contextFor([quote], user), true);
}

// ── Reading ─────────────────────────────────────────────────────────────────

router.get(
  '/',
  requirePermission('quotes.view'),
  route(async (req, res) => {
    const filter: Record<string, unknown> = {};
    const status = queryString(req, 'status');
    if (status && QUOTE_STATUSES.includes(status as QuoteStatus)) filter.status = status;
    const companyId = queryString(req, 'companyId');
    if (companyId) filter.companyId = objectId(companyId, 'That company');
    const clientId = queryString(req, 'clientId');
    if (clientId) filter.clientId = objectId(clientId, 'That client');
    const quotes = await Quote.find(filter).sort({ issueDate: -1, createdAt: -1 });
    const context = await contextFor(quotes, currentUser(req));
    res.json(quotes.map((quote) => toDto(quote, context, false)));
  }),
);

router.get(
  '/:id',
  requirePermission('quotes.view'),
  route(async (req, res) => {
    res.json(await one(await load(req.params.id), currentUser(req)));
  }),
);

// ── Writing ─────────────────────────────────────────────────────────────────

router.post(
  '/',
  requirePermission('quotes.manage'),
  route(async (req, res) => {
    const input = parse(quoteInputSchema, req.body);
    const user = currentUser(req);
    const [company] = await Promise.all([companyForInput(input.companyId), clientForInput(input.clientId)]);
    const quote = await Quote.create({
      ...contentOf(input),
      companyId: company._id,
      number: await nextCustomerNumber(company, 'quote'),
      status: 'draft',
      authorIds: [user._id],
      activity: [activityEntry(user, 'Created')],
      createdById: user._id,
      createdByName: user.name,
    });
    res.status(201).json(await one(quote, user));
  }),
);

/** Only a draft can be edited. To change a quote that has moved on, take it back to draft first, which clears its approvals. */
router.put(
  '/:id',
  requirePermission('quotes.manage'),
  route(async (req, res) => {
    const input = parse(quoteInputSchema, req.body);
    const user = currentUser(req);
    const quote = await load(req.params.id);
    if (quote.status !== 'draft') throw conflict('Only a draft can be edited. Take this quote back to draft first.');
    if (String(quote.companyId) !== input.companyId) {
      throw validationError({ companyId: 'The company cannot change because the quote number belongs to it' });
    }
    await clientForInput(input.clientId, quote.clientId);
    quote.set(contentOf(input));
    if (!quote.authorIds.some((id) => String(id) === String(user._id))) quote.authorIds.push(user._id);
    record(quote, user, 'Edited');
    await quote.save();
    res.json(await one(quote, user));
  }),
);

router.delete(
  '/:id',
  requirePermission('quotes.manage'),
  route(async (req, res) => {
    const quote = await load(req.params.id);
    const deleted = await Quote.deleteOne({ _id: quote._id, status: 'draft' });
    if (deleted.deletedCount === 0) throw conflict('Only a draft can be deleted.');
    res.status(204).end();
  }),
);

// ── Moving a quote along ────────────────────────────────────────────────────

const quotePath = (quote: QuoteDoc) => `/quotes/${String(quote._id)}`;

async function summaryRows(quote: QuoteDoc): Promise<[string, string][]> {
  const clients = await namesOf(Client, [quote.clientId]);
  return [
    ['Quote', quote.number],
    ['Client', clients.get(String(quote.clientId)) ?? ''],
    ['Title', quote.title],
    ['Total', formatMoney(quote.total)],
  ];
}

router.post(
  '/:id/submit',
  requirePermission('quotes.manage'),
  route(async (req, res) => {
    const user = currentUser(req);
    const quote = await load(req.params.id);
    if (quote.status !== 'draft') throw conflict('This quote has already been submitted.');
    const policy = await approvalPolicy();
    if (!quote.authorIds.some((id) => String(id) === String(user._id))) quote.authorIds.push(user._id);
    assertCanReachApproval(policy, quote.authorIds.map(String));

    quote.status = 'pending_approval';
    quote.approvals = [];
    quote.rejectionReason = '';
    record(quote, user, 'Submitted for approval');
    await quote.save();

    await notify(Quote, quote._id, user, approversToAsk(policy, quote.authorIds.map(String)), `Quote ${quote.number} needs your approval`, {
      heading: `Quote ${quote.number} needs your approval`,
      intro: `${user.name} submitted a quote for approval.`,
      rows: await summaryRows(quote),
      link: { label: 'Review the quote', path: quotePath(quote) },
    });
    res.json(await one(await load(req.params.id), user));
  }),
);

router.post(
  '/:id/approve',
  requirePermission('quotes.view'),
  route(async (req, res) => {
    const user = currentUser(req);
    const quote = await load(req.params.id);
    if (quote.status !== 'pending_approval') throw conflict('This quote is not waiting for approval.');
    const policy = await approvalPolicy();
    assertMayApprove(policy, user, quote.authorIds.map(String), quote.approvals);

    quote.approvals.push(approvalEntry(user));
    const done = isFullyApproved(policy, quote.approvals);
    if (done) quote.status = 'approved';
    record(quote, user, 'Approved', done ? '' : `${quote.approvals.length} of ${policy.required} approvals`);
    await quote.save();

    if (done) {
      await notify(Quote, quote._id, user, [String(quote.createdById)], `Quote ${quote.number} was approved`, {
        heading: `Quote ${quote.number} was approved`,
        intro: `${user.name} approved it. It can now be sent to the client.`,
        rows: await summaryRows(quote),
        link: { label: 'Open the quote', path: quotePath(quote) },
      });
    }
    res.json(await one(await load(req.params.id), user));
  }),
);

router.post(
  '/:id/reject',
  requirePermission('quotes.view'),
  route(async (req, res) => {
    const { reason } = parse(reasonSchema, req.body);
    const user = currentUser(req);
    const quote = await load(req.params.id);
    if (quote.status !== 'pending_approval') throw conflict('This quote is not waiting for approval.');
    assertMayApprove(await approvalPolicy(), user, quote.authorIds.map(String), quote.approvals);

    quote.status = 'draft';
    quote.approvals = [];
    quote.rejectionReason = reason;
    record(quote, user, 'Rejected', reason);
    await quote.save();

    await notify(Quote, quote._id, user, [String(quote.createdById)], `Quote ${quote.number} was rejected`, {
      heading: `Quote ${quote.number} was rejected`,
      intro: `${user.name} rejected it: ${reason}`,
      rows: await summaryRows(quote),
      link: { label: 'Open the quote', path: quotePath(quote) },
    });
    res.json(await one(await load(req.params.id), user));
  }),
);

/** Takes a quote back to draft so it can be changed. Its approvals are cleared: a changed quote is approved again. */
router.post(
  '/:id/revise',
  requirePermission('quotes.manage'),
  route(async (req, res) => {
    const user = currentUser(req);
    const quote = await load(req.params.id);
    if (quote.status === 'draft') throw conflict('This quote is already a draft.');
    if (quote.status === 'accepted' && (await Invoice.exists({ quoteId: quote._id, status: { $ne: 'cancelled' } }))) {
      throw conflict('This quote has been invoiced. Cancel or delete its invoices before changing it.');
    }
    const from = quote.status;
    quote.status = 'draft';
    quote.approvals = [];
    record(quote, user, 'Taken back to draft', from === 'approved' || from === 'sent' || from === 'accepted' ? 'Approvals cleared' : '');
    await quote.save();
    res.json(await one(quote, user));
  }),
);

function step(action: string, from: QuoteStatus[], to: QuoteStatus, label: string, wrongState: string) {
  router.post(
    `/:id/${action}`,
    requirePermission('quotes.manage'),
    route(async (req, res) => {
      const user = currentUser(req);
      const quote = await load(req.params.id);
      if (!from.includes(quote.status)) throw conflict(wrongState);
      quote.status = to;
      record(quote, user, label);
      await quote.save();
      res.json(await one(quote, user));
    }),
  );
}

step('send', ['approved'], 'sent', 'Marked as sent', 'A quote can only be sent once it is approved.');
step('accept', ['sent'], 'accepted', 'Accepted by the client', 'Only a quote that has been sent can be accepted.');
step('decline', ['sent'], 'declined', 'Declined by the client', 'Only a quote that has been sent can be declined.');

// ── Invoicing ───────────────────────────────────────────────────────────────

/**
 * Creates a draft invoice for one milestone, or for the whole quote when it
 * has no payment schedule. Each can be invoiced once: the invoice claims a
 * slot under a unique index, so a second attempt is refused by the database
 * even if two people click at the same moment.
 */
router.post(
  '/:id/invoices',
  requirePermission('invoices.manage'),
  route(async (req, res) => {
    const input = parse(convertQuoteSchema, req.body);
    const user = currentUser(req);
    const quote = await load(req.params.id);
    if (quote.status !== 'accepted') throw conflict('Only an accepted quote can be invoiced.');

    const base = {
      companyId: quote.companyId,
      clientId: quote.clientId,
      title: quote.title,
      issueDate: hkToday(),
      dueDate: null,
      notes: '',
      bankDetails: null,
    };
    let content;
    let milestone: QuoteDoc['paymentSchedule'][number] | null = null;
    if (quote.paymentSchedule.length > 0) {
      milestone = quote.paymentSchedule.find((candidate) => String(candidate._id) === input.milestoneId) ?? null;
      if (!milestone) throw validationError({ milestoneId: 'Choose which milestone to invoice' });
      content = {
        ...base,
        lineItems: [{ description: `${quote.title} — ${milestone.label} (${milestone.percentage}%)`, quantity: 1, unitPrice: milestone.amount }],
        discountType: 'none' as const,
        discountValue: 0,
      };
    } else {
      content = { ...base, lineItems: quote.lineItems, discountType: quote.discountType, discountValue: quote.discountValue };
    }
    const amount = milestone ? milestone.amount : quote.total;
    if (amount <= 0) throw conflict('There is nothing to invoice: the amount is zero.');

    const slot = `${String(quote._id)}:${milestone ? String(milestone._id) : 'full'}`;
    let invoice;
    try {
      invoice = await createDraftInvoice(content, user, `From quote ${quote.number}`, {
        quoteId: quote._id,
        quoteNumber: quote.number,
        milestoneId: milestone ? new Types.ObjectId(String(milestone._id)) : null,
        milestoneLabel: milestone?.label ?? '',
        quoteSlot: slot,
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw conflict(milestone ? `"${milestone.label}" has already been invoiced.` : 'This quote has already been invoiced.');
      }
      throw err;
    }
    await Quote.updateOne(
      { _id: quote._id },
      { $push: { activity: activityEntry(user, 'Invoice created', milestone ? milestone.label : 'Whole quote') } },
    );
    res.status(201).json(await invoiceDto(invoice, user));
  }),
);

// ── PDF ─────────────────────────────────────────────────────────────────────

router.get(
  '/:id/pdf',
  requirePermission('quotes.view'),
  route(async (req, res) => {
    const quote = await load(req.params.id);
    const [{ pdf }, client] = await Promise.all([pdfCompany(quote.companyId), Client.findById(quote.clientId)]);
    const document = React.createElement(QuotePDF, {
      company: pdf,
      quote: {
        number: quote.number,
        // The chop and signature are only printed once the quote is approved.
        draft: quote.status === 'draft' || quote.status === 'pending_approval',
        title: quote.title,
        issueDate: formatDate(quote.issueDate),
        validUntil: formatDate(quote.validUntil),
        client: {
          name: client?.name ?? 'Removed client',
          contactPerson: client?.contactPerson ?? '',
          email: client?.email ?? '',
          address: client?.address ?? '',
        },
        lines: quote.lineItems,
        subtotal: quote.subtotal,
        discount: quote.discount,
        discountPercent: quote.discountType === 'percent' ? quote.discountValue : null,
        total: quote.total,
        schedule: quote.paymentSchedule.map((milestone) => ({
          label: milestone.label,
          percentage: milestone.percentage,
          amount: milestone.amount,
          dueDescription: milestone.dueDescription,
        })),
        notes: quote.notes,
        terms: quote.terms,
      },
    });
    sendPdf(res, `${quote.number}.pdf`, await renderPdf(document));
  }),
);

export default router;
