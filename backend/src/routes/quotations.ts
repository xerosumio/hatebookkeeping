import { Router } from 'express';
import { z } from 'zod';
import { Quotation } from '../models/Quotation.js';
import { getNextSequence } from '../models/Counter.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authMiddleware);

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().int(),
  amount: z.number().int(),
});

const milestoneSchema = z.object({
  milestone: z.string().min(1),
  percentage: z.number().min(0).max(100),
  amount: z.number().int(),
  dueDescription: z.string().optional().default(''),
});

const quotationSchema = z.object({
  client: z.string().min(1),
  title: z.string().min(1),
  lineItems: z.array(lineItemSchema).min(1),
  subtotal: z.number().int(),
  discount: z.number().int().optional().default(0),
  total: z.number().int(),
  termsAndConditions: z.string().optional().default(''),
  paymentSchedule: z.array(milestoneSchema).optional().default([]),
  companyChopUrl: z.string().optional().default(''),
  signatureUrl: z.string().optional().default(''),
  validUntil: z.string().optional(),
  notes: z.string().optional().default(''),
});

const statusSchema = z.object({
  status: z.enum(['sent', 'accepted', 'rejected']),
});

router.get('/', async (req, res, next) => {
  try {
    const { status, client } = req.query;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (client) filter.client = client;

    const quotations = await Quotation.find(filter)
      .populate('client', 'name')
      .sort({ createdAt: -1 });
    res.json(quotations);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = quotationSchema.parse(req.body);
    const quotationNumber = await getNextSequence('quo');
    const quotation = await Quotation.create({
      ...data,
      quotationNumber,
      createdBy: req.user!._id,
    });
    res.status(201).json(quotation);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('client');
    if (!quotation) throw new AppError(404, 'Quotation not found');
    res.json(quotation);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await Quotation.findById(req.params.id);
    if (!existing) throw new AppError(404, 'Quotation not found');
    if (existing.status !== 'draft') {
      throw new AppError(400, 'Can only edit draft quotations');
    }

    const data = quotationSchema.parse(req.body);
    const quotation = await Quotation.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json(quotation);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = statusSchema.parse(req.body);
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) throw new AppError(404, 'Quotation not found');

    const validTransitions: Record<string, string[]> = {
      draft: ['sent'],
      sent: ['accepted', 'rejected'],
    };

    const allowed = validTransitions[quotation.status] || [];
    if (!allowed.includes(status)) {
      throw new AppError(400, `Cannot transition from ${quotation.status} to ${status}`);
    }

    quotation.status = status;
    await quotation.save();
    res.json(quotation);
  } catch (error) {
    next(error);
  }
});

export default router;
