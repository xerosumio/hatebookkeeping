import { Router } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { Receipt } from '../models/Receipt.js';
import { Invoice } from '../models/Invoice.js';
import { Transaction } from '../models/Transaction.js';
import { adjustFundBalance } from '../utils/fundBalance.js';
import { getNextSequence } from '../models/Counter.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { ReceiptPDF } from '../utils/pdf/ReceiptPDF.js';
import { getSettings } from '../models/Settings.js';
import { env } from '../config/env.js';

const router = Router();
router.use(authMiddleware);

const receiptSchema = z.object({
  invoice: z.string().min(1),
  amount: z.number().int().positive(),
  paymentMethod: z.string().optional().default('bank_transfer'),
  paymentDate: z.string(),
  bankReference: z.string().optional().default(''),
  bankAccount: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  companyChopUrl: z.string().optional().default(''),
  signatureUrl: z.string().optional().default(''),
});

router.get('/', async (req, res, next) => {
  try {
    const { entity } = req.query;
    const filter: Record<string, unknown> = {};
    if (entity) filter.entity = entity;
    const receipts = await Receipt.find(filter)
      .populate('entity', 'code name')
      .populate('client', 'name')
      .populate('invoice', 'invoiceNumber total')
      .sort({ createdAt: -1 });
    res.json(receipts);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = receiptSchema.parse(req.body);

    // Validate invoice
    const invoice = await Invoice.findById(data.invoice);
    if (!invoice) throw new AppError(404, 'Invoice not found');
    const existingReceipts = await Receipt.countDocuments({ invoice: invoice._id });
    if (invoice.status === 'paid' && existingReceipts > 0) {
      throw new AppError(400, 'Invoice is already fully paid');
    }

    // Create receipt
    const receiptNumber = await getNextSequence('rec');
    const receipt = await Receipt.create({
      ...data,
      receiptNumber,
      entity: invoice.entity,
      client: invoice.client,
      createdBy: req.user!._id,
    });

    // Update invoice payment status
    invoice.amountPaid += data.amount;
    invoice.amountDue = invoice.total - invoice.amountPaid;
    invoice.status = invoice.amountDue <= 0 ? 'paid' : 'partial';
    await invoice.save();

    // Auto-create income transaction
    await Transaction.create({
      date: new Date(data.paymentDate),
      type: 'income',
      category: 'revenue',
      description: `Payment received — ${invoice.invoiceNumber}`,
      amount: data.amount,
      entity: invoice.entity,
      invoice: invoice._id,
      receipt: receipt._id,
      bankAccount: data.bankAccount,
      bankReference: data.bankReference,
      reconciled: !!data.bankReference,
      createdBy: req.user!._id,
    });

    await adjustFundBalance(data.bankAccount, data.amount);

    res.status(201).json(receipt);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const receipt = await Receipt.findById(req.params.id)
      .populate('client')
      .populate({
        path: 'invoice',
        populate: { path: 'quotation', select: 'quotationNumber title' },
      });
    if (!receipt) throw new AppError(404, 'Receipt not found');
    res.json(receipt);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) throw new AppError(404, 'Receipt not found');

    // Reverse invoice payment
    const invoice = await Invoice.findById(receipt.invoice);
    if (invoice) {
      invoice.amountPaid = Math.max(0, invoice.amountPaid - receipt.amount);
      invoice.amountDue = invoice.total - invoice.amountPaid;
      invoice.status = invoice.amountPaid <= 0 ? 'unpaid' : invoice.amountDue <= 0 ? 'paid' : 'partial';
      await invoice.save();
    }

    // Delete associated transaction and reverse fund balance
    const txn = await Transaction.findOne({ receipt: receipt._id });
    if (txn) {
      await adjustFundBalance(txn.bankAccount, -txn.amount);
      await Transaction.deleteOne({ _id: txn._id });
    }

    await Receipt.deleteOne({ _id: receipt._id });
    res.json({ message: 'Receipt deleted' });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/pdf', async (req, res, next) => {
  try {
    const receipt = await Receipt.findById(req.params.id)
      .populate('client')
      .populate({
        path: 'invoice',
        populate: [
          { path: 'quotation', select: 'quotationNumber title' },
          { path: 'entity' },
        ],
      });
    if (!receipt) throw new AppError(404, 'Receipt not found');

    const invoiceEntity = (receipt.invoice as any)?.entity;
    const settings = await getSettings();
    const company = invoiceEntity
      ? { companyName: invoiceEntity.name, companyAddress: invoiceEntity.address, companyPhone: invoiceEntity.phone, companyEmail: invoiceEntity.email, companyWebsite: invoiceEntity.website, logoUrl: invoiceEntity.logoUrl, brandColor: invoiceEntity.brandColor, companyChopUrl: invoiceEntity.companyChopUrl, signatureUrl: invoiceEntity.signatureUrl, bankAccounts: invoiceEntity.bankAccounts }
      : { ...settings.toObject() } as any;
    for (const field of ['logoUrl', 'companyChopUrl', 'signatureUrl'] as const) {
      if (company[field]) {
        const file = company[field].replace(/^\/api\/uploads\//, '');
        const abs = path.resolve(env.uploadDir, file);
        company[field] = fs.existsSync(abs) && fs.statSync(abs).size > 0 ? abs : '';
      }
    }
    const rcpt = receipt as any;
    for (const field of ['companyChopUrl', 'signatureUrl'] as const) {
      if (rcpt[field] && rcpt[field].startsWith('/api/uploads/')) {
        const file = rcpt[field].replace(/^\/api\/uploads\//, '');
        const abs = path.resolve(env.uploadDir, file);
        rcpt[field] = fs.existsSync(abs) && fs.statSync(abs).size > 0 ? abs : '';
      }
    }
    if (!rcpt.companyChopUrl && company.companyChopUrl) rcpt.companyChopUrl = company.companyChopUrl;
    if (!rcpt.signatureUrl && company.signatureUrl) rcpt.signatureUrl = company.signatureUrl;
    const buffer = await renderToBuffer(
      React.createElement(ReceiptPDF, { receipt: rcpt, company }) as any,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${receipt.receiptNumber}.pdf"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
});

export default router;
