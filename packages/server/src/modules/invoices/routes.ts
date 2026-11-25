import { Router } from 'express';
import React from 'react';
import {
  INVOICE_STATUSES,
  PAYMENT_METHOD_LABELS,
  formatDate,
  formatMoney,
  hkToday,
  invoiceInputSchema,
  paymentInputSchema,
  reasonSchema,
  type InvoiceStatus,
} from '@hbk/shared';
import { InvoicePDF } from '../../integrations/pdf/InvoicePDF.js';
import { ReceiptPDF } from '../../integrations/pdf/ReceiptPDF.js';
import { renderPdf, sendPdf } from '../../integrations/pdf/render.js';
import type { PdfParty } from '../../integrations/pdf/types.js';
import { activityEntry, record } from '../../platform/activity.js';
import { currentUser, requirePermission } from '../../platform/auth.js';
import { conflict, notFound, validationError } from '../../platform/errors.js';
import { objectId, parse, queryString, route } from '../../platform/http.js';
import { Client } from '../clients/model.js';
import { clientForInput } from '../clients/routes.js';
import { companyForInput, nextCustomerNumber, pdfCompany } from '../companies/service.js';
import { Invoice, Payment, type InvoiceDoc } from './model.js';
import { createDraftInvoice, invoiceDto, invoiceDtos, invoiceFields } from './service.js';

const router = Router();
export const paymentRouter = Router();

async function load(id: unknown): Promise<InvoiceDoc> {
  const invoice = await Invoice.findById(objectId(id, 'That invoice'));
  if (!invoice) throw notFound('That invoice');
  return invoice;
}

router.get(
  '/',
  requirePermission('invoices.view'),
  route(async (req, res) => {
    const filter: Record<string, unknown> = {};
    const status = queryString(req, 'status');
    if (status === 'open') filter.status = { $in: ['unpaid', 'partial'] };
    else if (status === 'overdue') Object.assign(filter, { status: { $in: ['unpaid', 'partial'] }, dueDate: { $ne: null, $lt: hkToday() } });
    else if (status && INVOICE_STATUSES.includes(status as InvoiceStatus)) filter.status = status;
    const companyId = queryString(req, 'companyId');
    if (companyId) filter.companyId = objectId(companyId, 'That company');
    const clientId = queryString(req, 'clientId');
    if (clientId) filter.clientId = objectId(clientId, 'That client');

    const invoices = await Invoice.find(filter).sort({ issueDate: -1, createdAt: -1 });
    res.json(await invoiceDtos(invoices, currentUser(req)));
  }),
);

router.get(
  '/:id',
  requirePermission('invoices.view'),
  route(async (req, res) => {
    res.json(await invoiceDto(await load(req.params.id), currentUser(req)));
  }),
);

router.post(
  '/',
  requirePermission('invoices.manage'),
  route(async (req, res) => {
    const input = parse(invoiceInputSchema, req.body);
    await Promise.all([companyForInput(input.companyId), clientForInput(input.clientId)]);
    const invoice = await createDraftInvoice(input, currentUser(req), '');
    res.status(201).json(await invoiceDto(invoice, currentUser(req)));
  }),
);

/**
 * A draft can be changed freely. An issued invoice can be changed while money
 * is still owed, but its payments stay and the total cannot drop below what
 * has been received. A paid or cancelled invoice is locked.
 */
router.put(
  '/:id',
  requirePermission('invoices.manage'),
  route(async (req, res) => {
    const input = parse(invoiceInputSchema, req.body);
    const invoice = await load(req.params.id);
    if (invoice.status === 'paid') throw conflict('This invoice is paid and can no longer be changed. An admin can void a payment first if it was recorded by mistake.');
    if (invoice.status === 'cancelled') throw conflict('This invoice is cancelled and can no longer be changed.');
    await Promise.all([companyForInput(input.companyId, invoice.companyId), clientForInput(input.clientId, invoice.clientId)]);

    const fields = invoiceFields(input);
    if (invoice.status !== 'draft') {
      if (String(invoice.companyId) !== input.companyId) {
        throw validationError({ companyId: 'The company cannot change once the invoice has a number' });
      }
      if (fields.total < invoice.amountPaid) {
        throw validationError({ lineItems: `The total cannot go below the ${formatMoney(invoice.amountPaid)} already received` });
      }
    }
    invoice.set(fields);
    if (invoice.status !== 'draft') {
      invoice.status = invoice.amountPaid >= invoice.total ? 'paid' : invoice.amountPaid > 0 ? 'partial' : 'unpaid';
    }
    record(invoice, currentUser(req), 'Edited', invoice.status === 'draft' ? '' : `Total is now ${formatMoney(invoice.total)}`);
    // Saved against the version that was read: a payment recorded meanwhile makes this fail with "reload and try again".
    await invoice.save();
    res.json(await invoiceDto(invoice, currentUser(req)));
  }),
);

/** Only a draft can be deleted. An issued invoice is cancelled instead, so its number is never reused. */
router.delete(
  '/:id',
  requirePermission('invoices.manage'),
  route(async (req, res) => {
    const invoice = await load(req.params.id);
    const deleted = await Invoice.deleteOne({ _id: invoice._id, status: 'draft' });
    if (deleted.deletedCount === 0) {
      throw conflict('Only a draft can be deleted. Cancel this invoice instead.');
    }
    res.status(204).end();
  }),
);

router.post(
  '/:id/issue',
  requirePermission('invoices.manage'),
  route(async (req, res) => {
    const invoice = await load(req.params.id);
    if (invoice.status !== 'draft') throw conflict('This invoice has already been issued.');
    const { company } = await pdfCompany(invoice.companyId);
    const number = await nextCustomerNumber(company, 'invoice');
    const issued = await Invoice.findOneAndUpdate(
      { _id: invoice._id, status: 'draft' },
      { $set: { status: 'unpaid', number }, $push: { activity: activityEntry(currentUser(req), 'Issued', number) }, $inc: { __v: 1 } },
      { new: true },
    );
    if (!issued) throw conflict('This invoice has already been issued.');
    res.json(await invoiceDto(issued, currentUser(req)));
  }),
);

/** An issued invoice with nothing received can be cancelled. It keeps its number and frees the quote for a new invoice. */
router.post(
  '/:id/cancel',
  requirePermission('invoices.manage'),
  route(async (req, res) => {
    const { reason } = parse(reasonSchema, req.body);
    const invoice = await load(req.params.id);
    const cancelled = await Invoice.findOneAndUpdate(
      { _id: invoice._id, status: 'unpaid', amountPaid: 0 },
      {
        $set: { status: 'cancelled', cancelReason: reason },
        $unset: { quoteSlot: 1 },
        $push: { activity: activityEntry(currentUser(req), 'Cancelled', reason) },
        $inc: { __v: 1 },
      },
      { new: true },
    );
    if (!cancelled) {
      if (invoice.status === 'draft') throw conflict('This is still a draft. Delete it instead.');
      if (invoice.status === 'cancelled') throw conflict('This invoice is already cancelled.');
      throw conflict('This invoice has payments recorded. An admin must void them before it can be cancelled.');
    }
    res.json(await invoiceDto(cancelled, currentUser(req)));
  }),
);

// ── Payments ────────────────────────────────────────────────────────────────

const statusAfter = (paid: unknown) => ({
  $cond: [{ $gte: [paid, '$total'] }, 'paid', { $cond: [{ $gt: [paid, 0] }, 'partial', 'unpaid'] }],
});

router.post(
  '/:id/payments',
  requirePermission('payments.record'),
  route(async (req, res) => {
    const input = parse(paymentInputSchema, req.body);
    if (input.date > hkToday()) throw validationError({ date: 'A payment cannot be dated in the future' });
    const user = currentUser(req);
    const invoice = await load(req.params.id);

    // One atomic step takes the money against the invoice, so two people
    // recording at once can never take it past what is owed.
    const paid = { $add: ['$amountPaid', input.amount] };
    const updated = await Invoice.findOneAndUpdate(
      { _id: invoice._id, status: { $in: ['unpaid', 'partial'] }, $expr: { $lte: [paid, '$total'] } },
      [{ $set: { amountPaid: paid, status: statusAfter(paid), __v: { $add: ['$__v', 1] } } }],
      { new: true },
    );
    if (!updated) {
      const now = await load(req.params.id);
      if (now.status === 'draft') throw conflict('Issue this invoice before recording a payment.');
      if (now.status === 'cancelled') throw conflict('This invoice is cancelled.');
      if (now.status === 'paid') throw conflict('This invoice is already paid in full.');
      throw validationError({ amount: `Only ${formatMoney(now.total - now.amountPaid)} is still owed on this invoice` });
    }

    try {
      const { company } = await pdfCompany(updated.companyId);
      const payment = await Payment.create({
        number: await nextCustomerNumber(company, 'receipt'),
        invoiceId: updated._id,
        companyId: updated.companyId,
        clientId: updated.clientId,
        ...input,
        createdById: user._id,
        createdByName: user.name,
      });
      await Invoice.updateOne(
        { _id: updated._id },
        { $push: { activity: activityEntry(user, 'Payment recorded', `${formatMoney(input.amount)} on ${formatDate(input.date)} · receipt ${payment.number}`) } },
      );
    } catch (err) {
      // The receipt could not be written: give the money back so the invoice matches its payments.
      const back = { $subtract: ['$amountPaid', input.amount] };
      await Invoice.updateOne({ _id: updated._id }, [{ $set: { amountPaid: back, status: statusAfter(back), __v: { $add: ['$__v', 1] } } }]);
      throw err;
    }
    res.status(201).json(await invoiceDto(await load(req.params.id), user));
  }),
);

/** A payment is never deleted. An admin voids it with a reason; the receipt stays on file marked void. */
paymentRouter.post(
  '/:id/void',
  requirePermission('payments.void'),
  route(async (req, res) => {
    const { reason } = parse(reasonSchema, req.body);
    const user = currentUser(req);
    const payment = await Payment.findOneAndUpdate(
      { _id: objectId(req.params.id, 'That payment'), voided: false },
      { $set: { voided: true, voidReason: reason, voidedAt: new Date() } },
      { new: true },
    );
    if (!payment) {
      if (await Payment.exists({ _id: req.params.id })) throw conflict('This payment has already been voided.');
      throw notFound('That payment');
    }
    const back = { $max: [0, { $subtract: ['$amountPaid', payment.amount] }] };
    await Invoice.updateOne({ _id: payment.invoiceId }, [
      {
        $set: {
          amountPaid: back,
          status: statusAfter(back),
          __v: { $add: ['$__v', 1] },
          activity: {
            // $literal: the reason is a person's text and must never be read as a field path.
            $concatArrays: [
              '$activity',
              { $literal: [activityEntry(user, 'Payment voided', `${formatMoney(payment.amount)} · receipt ${payment.number} · ${reason}`)] },
            ],
          },
        },
      },
    ]);
    res.json(await invoiceDto(await load(String(payment.invoiceId)), user));
  }),
);

// ── PDFs ────────────────────────────────────────────────────────────────────

async function partyOf(clientId: unknown): Promise<PdfParty> {
  const client = await Client.findById(clientId);
  return {
    name: client?.name ?? 'Removed client',
    contactPerson: client?.contactPerson ?? '',
    email: client?.email ?? '',
    address: client?.address ?? '',
  };
}

router.get(
  '/:id/pdf',
  requirePermission('invoices.view'),
  route(async (req, res) => {
    const invoice = await load(req.params.id);
    const [{ company, pdf }, client] = await Promise.all([pdfCompany(invoice.companyId), partyOf(invoice.clientId)]);
    const number = invoice.number || 'DRAFT';
    const document = React.createElement(InvoicePDF, {
      company: pdf,
      invoice: {
        number,
        watermark: invoice.status === 'draft' ? 'DRAFT' : invoice.status === 'cancelled' ? 'CANCELLED' : '',
        title: invoice.title,
        issueDate: formatDate(invoice.issueDate),
        dueDate: formatDate(invoice.dueDate),
        milestoneLabel: invoice.milestoneLabel,
        quoteNumber: invoice.quoteNumber,
        client,
        lines: invoice.lineItems,
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        total: invoice.total,
        amountPaid: invoice.amountPaid,
        amountDue: invoice.status === 'cancelled' ? 0 : invoice.total - invoice.amountPaid,
        bankDetails: invoice.bankDetails ?? company.bankDetails,
        notes: invoice.notes,
      },
    });
    sendPdf(res, `${number}.pdf`, await renderPdf(document));
  }),
);

paymentRouter.get(
  '/:id/pdf',
  requirePermission('invoices.view'),
  route(async (req, res) => {
    const payment = await Payment.findById(objectId(req.params.id, 'That payment'));
    if (!payment) throw notFound('That payment');
    const invoice = await load(String(payment.invoiceId));
    const [{ pdf }, client] = await Promise.all([pdfCompany(payment.companyId), partyOf(payment.clientId)]);
    const document = React.createElement(ReceiptPDF, {
      company: pdf,
      receipt: {
        number: payment.number,
        voided: payment.voided,
        date: formatDate(payment.date),
        method: PAYMENT_METHOD_LABELS[payment.method],
        reference: payment.reference,
        client,
        invoiceNumber: invoice.number,
        invoiceTitle: invoice.title,
        milestoneLabel: invoice.milestoneLabel,
        quoteNumber: invoice.quoteNumber,
        invoiceTotal: invoice.total,
        balanceDue: invoice.total - invoice.amountPaid,
        amount: payment.amount,
        notes: payment.notes,
      },
    });
    sendPdf(res, `${payment.number}.pdf`, await renderPdf(document));
  }),
);

export default router;
