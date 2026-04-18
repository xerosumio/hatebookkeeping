import { Router } from 'express';
import { z } from 'zod';
import { Transaction } from '../models/Transaction.js';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authMiddleware);

const transactionSchema = z.object({
  date: z.string(),
  type: z.enum(['income', 'expense']),
  category: z.enum([
    'revenue', 'salary', 'reimbursement', 'rent', 'utilities',
    'software_subscription', 'professional_fees', 'tax', 'other',
  ]),
  description: z.string().min(1),
  amount: z.number().int().positive(),
  bankReference: z.string().optional().default(''),
  bankAccount: z.string().optional().default(''),
  reconciled: z.boolean().optional().default(false),
});

router.get('/', async (req, res, next) => {
  try {
    const { type, category, startDate, endDate, reconciled } = req.query;
    const filter: Record<string, unknown> = {};
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (reconciled !== undefined) filter.reconciled = reconciled === 'true';
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) (filter.date as Record<string, unknown>).$gte = new Date(startDate as string);
      if (endDate) (filter.date as Record<string, unknown>).$lte = new Date(endDate as string);
    }

    const transactions = await Transaction.find(filter).sort({ date: -1 });
    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

router.post('/', roleGuard('admin', 'maker'), async (req: AuthRequest, res, next) => {
  try {
    const data = transactionSchema.parse(req.body);
    const transaction = await Transaction.create({
      ...data,
      date: new Date(data.date),
      createdBy: req.user!._id,
    });
    res.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) throw new AppError(404, 'Transaction not found');
    res.json(transaction);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', roleGuard('admin', 'maker'), async (req, res, next) => {
  try {
    const data = transactionSchema.parse(req.body);
    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      { ...data, date: new Date(data.date) },
      { new: true },
    );
    if (!transaction) throw new AppError(404, 'Transaction not found');
    res.json(transaction);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', roleGuard('admin', 'maker'), async (req, res, next) => {
  try {
    const transaction = await Transaction.findByIdAndDelete(req.params.id);
    if (!transaction) throw new AppError(404, 'Transaction not found');
    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
