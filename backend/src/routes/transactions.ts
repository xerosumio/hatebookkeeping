import { Router } from 'express';
import { z } from 'zod';
import { Transaction } from '../models/Transaction.js';
import { adjustFundBalance } from '../utils/fundBalance.js';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authMiddleware);

const transactionSchema = z.object({
  date: z.string(),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().int().positive(),
  entity: z.string().optional(),
  bankReference: z.string().optional().default(''),
  bankAccount: z.string().optional().default(''),
  reconciled: z.boolean().optional().default(false),
});

router.get('/', async (req, res, next) => {
  try {
    const { type, category, startDate, endDate, reconciled, entity } = req.query;
    const filter: Record<string, unknown> = {};
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (entity) filter.entity = entity;
    if (reconciled !== undefined) filter.reconciled = reconciled === 'true';
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) (filter.date as Record<string, unknown>).$gte = new Date(startDate as string);
      if (endDate) (filter.date as Record<string, unknown>).$lte = new Date(endDate as string);
    }

    const transactions = await Transaction.find(filter)
      .populate('entity', 'code name')
      .populate('payee', 'name')
      .populate({ path: 'invoice', select: 'invoiceNumber client', populate: { path: 'client', select: 'name' } })
      .populate({ path: 'paymentRequest', select: 'requestNumber items', populate: { path: 'items.payee', select: 'name' } })
      .sort({ date: -1 });
    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

router.post('/', roleGuard('admin', 'user'), async (req: AuthRequest, res, next) => {
  try {
    const data = transactionSchema.parse(req.body);
    const transaction = await Transaction.create({
      ...data,
      date: new Date(data.date),
      createdBy: req.user!._id,
    });

    if (data.bankAccount) {
      const delta = data.type === 'income' ? data.amount : -data.amount;
      await adjustFundBalance(data.bankAccount, delta);
    }

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

router.put('/:id', roleGuard('admin', 'user'), async (req, res, next) => {
  try {
    const data = transactionSchema.parse(req.body);

    const old = await Transaction.findById(req.params.id);
    if (!old) throw new AppError(404, 'Transaction not found');

    if (old.bankAccount) {
      const oldDelta = old.type === 'income' ? -old.amount : old.amount;
      await adjustFundBalance(old.bankAccount, oldDelta);
    }

    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      { ...data, date: new Date(data.date) },
      { new: true },
    );

    if (data.bankAccount) {
      const newDelta = data.type === 'income' ? data.amount : -data.amount;
      await adjustFundBalance(data.bankAccount, newDelta);
    }

    res.json(transaction!);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', roleGuard('admin', 'user'), async (req, res, next) => {
  try {
    const transaction = await Transaction.findByIdAndDelete(req.params.id);
    if (!transaction) throw new AppError(404, 'Transaction not found');

    if (transaction.bankAccount) {
      const reverseDelta = transaction.type === 'income' ? -transaction.amount : transaction.amount;
      await adjustFundBalance(transaction.bankAccount, reverseDelta);
    }

    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
