import { Router } from 'express';
import { z } from 'zod';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { Invoice } from '../models/Invoice.js';
import { Quotation } from '../models/Quotation.js';
import { getNextSequence } from '../models/Counter.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { InvoicePDF } from '../utils/pdf/InvoicePDF.js';

const router = Router();
router.use(authMiddleware);

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().int(),
  amount: z.number().int(),
});

const invoiceSchema = z.object({
  client: z.string().min(1),
  quotation: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1),
  subtotal: z.number().int(),
  discount: z.number().int().optional().default(0),
  total: z.number().int(),
  milestone: z.string().optional().default(''),
  dueDate: z.string().optional(),
  notes: z.string().optional().default(''),
  companyChopUrl: z.string().optional().default(''),
  signatureUrl: z.string().optional().default(''),
});

router.get('/', async (req, res, next) => {
  try {
    const { status, client } = req.query;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (client) filter.client = client;

    const invoices = await Invoice.find(filter)
      .populate('client', 'name')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = invoiceSchema.parse(req.body);
    const invoiceNumber = await getNextSequence('inv');
    const invoice = await Invoice.create({
      ...data,
      invoiceNumber,
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
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { ...data, amountDue: data.total },
      { new: true },
    );
    if (!invoice) throw new AppError(404, 'Invoice not found');
    res.json(invoice);
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

    if (quotation.paymentSchedule.length > 0) {
      // Create one invoice per milestone
      for (const milestone of quotation.paymentSchedule) {
        const invoiceNumber = await getNextSequence('inv');
        // Proportionally split line items based on milestone percentage
        const lineItems = quotation.lineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: Math.round(item.unitPrice * milestone.percentage / 100),
          amount: Math.round(item.amount * milestone.percentage / 100),
        }));

        const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
        const discountPortion = Math.round(quotation.discount * milestone.percentage / 100);
        const total = milestone.amount;

        const invoice = await Invoice.create({
          invoiceNumber,
          quotation: quotation._id,
          client: quotation.client,
          lineItems,
          subtotal,
          discount: discountPortion,
          total,
          amountDue: total,
          milestone: milestone.milestone,
          notes: `From ${quotation.quotationNumber} — ${milestone.milestone}`,
          companyChopUrl: quotation.companyChopUrl,
          signatureUrl: quotation.signatureUrl,
          createdBy: req.user!._id,
        });
        invoices.push(invoice);
      }
    } else {
      // Single invoice for the full amount
      const invoiceNumber = await getNextSequence('inv');
      const invoice = await Invoice.create({
        invoiceNumber,
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
    const invoice = await Invoice.findById(req.params.id).populate('client');
    if (!invoice) throw new AppError(404, 'Invoice not found');

    const buffer = await renderToBuffer(
      React.createElement(InvoicePDF, { invoice: invoice as any }) as any,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
});

export default router;
