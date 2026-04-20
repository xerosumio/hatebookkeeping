import { Router } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { Invoice } from '../models/Invoice.js';
import { Receipt } from '../models/Receipt.js';
import { Transaction } from '../models/Transaction.js';
import { Quotation } from '../models/Quotation.js';
import { Entity } from '../models/Entity.js';
import { adjustFundBalance } from '../utils/fundBalance.js';
import { getNextSequence } from '../models/Counter.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { InvoicePDF } from '../utils/pdf/InvoicePDF.js';
import { getSettings } from '../models/Settings.js';
import { env } from '../config/env.js';

const router = Router();
router.use(authMiddleware);

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().int(),
  amount: z.number().int(),
});

const invoiceSchema = z.object({
  entity: z.string().min(1),
  client: z.string().min(1),
  quotation: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1),
  subtotal: z.number().int(),
  discount: z.number().int().optional().default(0),
  total: z.number().int(),
  milestone: z.string().optional().default(''),
  invoiceDate: z.string().optional(),
  paymentTerms: z.string().optional().default(''),
  dueDate: z.string().optional(),
  notes: z.string().optional().default(''),
  bankAccountInfo: z.string().optional().default(''),
  companyChopUrl: z.string().optional().default(''),
  signatureUrl: z.string().optional().default(''),
});

function computeDueDate(terms: string, fromDate?: Date): Date | undefined {
  if (!terms) return undefined;
  const base = fromDate || new Date();
  if (terms === 'due_on_receipt') return base;
  const match = terms.match(/^(?:net_|custom_)(\d+)$/);
  if (match) {
    const days = parseInt(match[1], 10);
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  }
  return undefined;
}

router.get('/', async (req, res, next) => {
  try {
    const { status, client, entity, quotation } = req.query;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (client) filter.client = client;
    if (entity) filter.entity = entity;
    if (quotation) filter.quotation = quotation;

    const invoices = await Invoice.find(filter)
      .populate('client', 'name')
      .populate('entity', 'code name')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = invoiceSchema.parse(req.body);
    const entity = await Entity.findById(data.entity);
    if (!entity) throw new AppError(400, 'Entity not found');
    const invoiceNumber = await getNextSequence('inv', entity.code);
    const invoiceDate = data.invoiceDate ? new Date(data.invoiceDate) : new Date();
    const dueDate = data.dueDate || computeDueDate(data.paymentTerms, invoiceDate);
    const invoice = await Invoice.create({
      ...data,
      invoiceNumber,
      invoiceDate,
      dueDate,
      amountDue: data.total,
      createdBy: req.user!._id,
    });
    res.status(201).json(invoice);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('client')
      .populate('entity')
      .populate('quotation', 'quotationNumber');
    if (!invoice) throw new AppError(404, 'Invoice not found');
    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const data = invoiceSchema.parse(req.body);
    const invoiceDate = data.invoiceDate ? new Date(data.invoiceDate) : undefined;
    const dueDate = data.dueDate || computeDueDate(data.paymentTerms, invoiceDate);
    const update: Record<string, unknown> = { ...data, dueDate, amountDue: data.total };
    if (invoiceDate) update.invoiceDate = invoiceDate;
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true },
    );
    if (!invoice) throw new AppError(404, 'Invoice not found');
    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = z.object({
      status: z.enum(['unpaid', 'partial', 'paid']),
    }).parse(req.body);

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) throw new AppError(404, 'Invoice not found');

    invoice.status = status;
    if (status === 'paid') {
      invoice.amountPaid = invoice.total;
      invoice.amountDue = 0;
    } else if (status === 'unpaid') {
      invoice.amountPaid = 0;
      invoice.amountDue = invoice.total;
    }
    await invoice.save();
    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) throw new AppError(404, 'Invoice not found');

    const receipts = await Receipt.find({ invoice: invoice._id });
    for (const receipt of receipts) {
      const txn = await Transaction.findOne({ receipt: receipt._id });
      if (txn) {
        await adjustFundBalance(txn.bankAccount, -txn.amount);
        await Transaction.deleteOne({ _id: txn._id });
      }
      await Receipt.deleteOne({ _id: receipt._id });
    }

    const txns = await Transaction.find({ invoice: invoice._id });
    for (const txn of txns) {
      const delta = txn.type === 'income' ? -txn.amount : txn.amount;
      await adjustFundBalance(txn.bankAccount, delta);
      await Transaction.deleteOne({ _id: txn._id });
    }

    await Invoice.deleteOne({ _id: invoice._id });
    res.json({ message: 'Invoice deleted' });
  } catch (error) {
    next(error);
  }
});

// Convert quotation to invoice(s)
router.post('/from-quotation/:quotationId', async (req: AuthRequest, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.quotationId);
    if (!quotation) throw new AppError(404, 'Quotation not found');
    if (quotation.status !== 'accepted') {
      throw new AppError(400, 'Quotation must be accepted before converting');
    }

    const invoices = [];

    const quoEntity = await Entity.findById(quotation.entity);
    const entityCode = quoEntity?.code;

    if (quotation.paymentSchedule.length > 0) {
      for (const milestone of quotation.paymentSchedule) {
        const invoiceNumber = await getNextSequence('inv', entityCode);
        const lineItems = [{
          description: `${milestone.milestone} (${milestone.percentage}%)`,
          quantity: 1,
          unitPrice: milestone.amount,
          amount: milestone.amount,
        }];

        const invoice = await Invoice.create({
          invoiceNumber,
          entity: quotation.entity,
          quotation: quotation._id,
          client: quotation.client,
          lineItems,
          subtotal: milestone.amount,
          discount: 0,
          total: milestone.amount,
          amountDue: milestone.amount,
          milestone: milestone.milestone,
          notes: `From ${quotation.quotationNumber}`,
          companyChopUrl: quotation.companyChopUrl,
          signatureUrl: quotation.signatureUrl,
          createdBy: req.user!._id,
        });
        invoices.push(invoice);
      }
    } else {
      // Single invoice for the full amount
      const invoiceNumber = await getNextSequence('inv', entityCode);
      const invoice = await Invoice.create({
        invoiceNumber,
        entity: quotation.entity,
        quotation: quotation._id,
        client: quotation.client,
        lineItems: quotation.lineItems,
        subtotal: quotation.subtotal,
        discount: quotation.discount,
        total: quotation.total,
        amountDue: quotation.total,
        notes: `From ${quotation.quotationNumber}`,
        companyChopUrl: quotation.companyChopUrl,
        signatureUrl: quotation.signatureUrl,
        createdBy: req.user!._id,
      });
      invoices.push(invoice);
    }

    res.status(201).json(invoices);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/pdf', async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('client').populate('entity');
    if (!invoice) throw new AppError(404, 'Invoice not found');

    const entityObj = (invoice as any).entity;
    const settings = await getSettings();
    const company = entityObj
      ? { companyName: entityObj.name, companyAddress: entityObj.address, companyPhone: entityObj.phone, companyEmail: entityObj.email, companyWebsite: entityObj.website, logoUrl: entityObj.logoUrl, brandColor: entityObj.brandColor, companyChopUrl: entityObj.companyChopUrl, signatureUrl: entityObj.signatureUrl, bankAccounts: entityObj.bankAccounts }
      : { ...settings.toObject() } as any;
    for (const field of ['logoUrl', 'companyChopUrl', 'signatureUrl'] as const) {
      if (company[field]) {
        const file = company[field].replace(/^\/api\/uploads\//, '');
        const abs = path.resolve(env.uploadDir, file);
        company[field] = fs.existsSync(abs) && fs.statSync(abs).size > 0 ? abs : '';
      }
    }
    const inv = invoice as any;
    for (const field of ['companyChopUrl', 'signatureUrl'] as const) {
      if (inv[field] && inv[field].startsWith('/api/uploads/')) {
        const file = inv[field].replace(/^\/api\/uploads\//, '');
        const abs = path.resolve(env.uploadDir, file);
        inv[field] = fs.existsSync(abs) && fs.statSync(abs).size > 0 ? abs : '';
      }
    }
    if (!inv.companyChopUrl && company.companyChopUrl) inv.companyChopUrl = company.companyChopUrl;
    if (!inv.signatureUrl && company.signatureUrl) inv.signatureUrl = company.signatureUrl;
    if (!inv.bankAccountInfo && company.bankAccountInfo) inv.bankAccountInfo = company.bankAccountInfo;
    const buffer = await renderToBuffer(
      React.createElement(InvoicePDF, { invoice: inv, company }) as any,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
});

export default router;
