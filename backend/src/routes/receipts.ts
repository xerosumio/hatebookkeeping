import { Router } from 'express';
import { z } from 'zod';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { Receipt } from '../models/Receipt.js';
import { Invoice } from '../models/Invoice.js';
import { Transaction } from '../models/Transaction.js';
import { getNextSequence } from '../models/Counter.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { ReceiptPDF } from '../utils/pdf/ReceiptPDF.js';

const router = Router();
router.use(authMiddleware);

const receiptSchema = z.object({
  invoice: z.string().min(1),
  amount: z.number().int().positive(),
  paymentMethod: z.string().optional().default('bank_transfer'),
  paymentDate: z.string(),
  bankReference: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  companyChopUrl: z.string().optional().default(''),
  signatureUrl: z.string().optional().default(''),
});

router.get('/', async (req, res, next) => {
  try {
    const receipts = await Receipt.find()
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
    if (invoice.status === 'paid') {
      throw new AppError(400, 'Invoice is already fully paid');
    }

    // Create receipt
    const receiptNumber = await getNextSequence('rec');
    const receipt = await Receipt.create({
      ...data,
      receiptNumber,
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
      invoice: invoice._id,
      receipt: receipt._id,
      bankReference: data.bankReference,
      reconciled: !!data.bankReference,
      createdBy: req.user!._id,
    });

    res.status(201).json(receipt);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const receipt = await Receipt.findById(req.params.id)
      .populate('client')
      .populate('invoice');
    if (!receipt) throw new AppError(404, 'Receipt not found');
    res.json(receipt);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/pdf', async (req, res, next) => {
  try {
    const receipt = await Receipt.findById(req.params.id)
      .populate('client')
      .populate('invoice');
    if (!receipt) throw new AppError(404, 'Receipt not found');

    const buffer = await renderToBuffer(
      React.createElement(ReceiptPDF, { receipt: receipt as any }) as any,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${receipt.receiptNumber}.pdf"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
});

export default router;
