import { Router } from 'express';
import { z } from 'zod';
import { Fund } from '../models/Fund.js';
import { FundTransfer } from '../models/FundTransfer.js';
import { Transaction } from '../models/Transaction.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

async function computeNetTransactions(fundName: string): Promise<number> {
  const results = await Transaction.aggregate([
    { $match: { bankAccount: fundName } },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ]);
  let income = 0;
  let expense = 0;
  for (const r of results) {
    if (r._id === 'income') income = r.total;
    if (r._id === 'expense') expense = r.total;
  }
  return income - expense;
}

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req, res, next) => {
  try {
    const funds = await Fund.find().populate('entity', 'code name').populate('heldIn', 'name type').sort({ type: 1, name: 1 });
    res.json(funds);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role !== 'admin') throw new AppError(403, 'Admin only');
    const data = z.object({
      name: z.string().min(1),
      type: z.enum(['reserve', 'bank', 'petty_cash']),
      entity: z.string().optional(),
      heldIn: z.string().optional(),
      openingBalance: z.number().optional().default(0),
      balance: z.number().optional().default(0),
    }).parse(req.body);

    const ob = data.openingBalance || data.balance;
    const fund = await Fund.create({ ...data, openingBalance: ob, balance: ob });
    res.status(201).json(fund);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role !== 'admin') throw new AppError(403, 'Admin only');
    const data = z.object({
      name: z.string().min(1).optional(),
      type: z.enum(['reserve', 'bank', 'petty_cash']).optional(),
      entity: z.string().nullable().optional(),
      heldIn: z.string().nullable().optional(),
      openingBalance: z.number().optional(),
      balance: z.number().optional(),
      active: z.boolean().optional(),
    }).parse(req.body);

    const update: Record<string, unknown> = { ...data };
    if (data.entity === null) update.entity = undefined;
    if (data.heldIn === null) update.heldIn = undefined;

    if (data.openingBalance !== undefined) {
      const existing = await Fund.findById(req.params.id);
      if (!existing) throw new AppError(404, 'Fund not found');
      const fundName = data.name || existing.name;
      const net = await computeNetTransactions(fundName);
      update.openingBalance = data.openingBalance;
      update.balance = data.openingBalance + net;
    }

    const fund = await Fund.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('entity', 'code name').populate('heldIn', 'name type');
    if (!fund) throw new AppError(404, 'Fund not found');
    res.json(fund);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role !== 'admin') throw new AppError(403, 'Admin only');
    const fund = await Fund.findById(req.params.id);
    if (!fund) throw new AppError(404, 'Fund not found');
    if (fund.balance !== 0) throw new AppError(400, 'Cannot delete a fund with non-zero balance');
    await Fund.findByIdAndDelete(req.params.id);
    res.json({ message: 'Fund deleted' });
  } catch (error) {
    next(error);
  }
});

router.post('/transfer', async (req: AuthRequest, res, next) => {
  try {
    const data = z.object({
      fromFund: z.string().optional(),
      toFund: z.string().optional(),
      amount: z.number().positive(),
      date: z.string().transform((s) => new Date(s)),
      description: z.string().min(1),
      reference: z.string().optional(),
    }).parse(req.body);

    if (!data.fromFund && !data.toFund) {
      throw new AppError(400, 'At least one of fromFund or toFund is required');
    }

    // Atomic balance updates
    if (data.fromFund) {
      const from = await Fund.findByIdAndUpdate(
        data.fromFund,
        { $inc: { balance: -data.amount } },
        { new: true },
      );
      if (!from) throw new AppError(404, 'Source fund not found');
    }

    if (data.toFund) {
      const to = await Fund.findByIdAndUpdate(
        data.toFund,
        { $inc: { balance: data.amount } },
        { new: true },
      );
      if (!to) throw new AppError(404, 'Destination fund not found');
    }

    const transfer = await FundTransfer.create({
      fromFund: data.fromFund || undefined,
      toFund: data.toFund || undefined,
      amount: data.amount,
      date: data.date,
      description: data.description,
      reference: data.reference,
      createdBy: req.user!._id,
    });

    const populated = await transfer.populate([
      { path: 'fromFund', select: 'name type' },
      { path: 'toFund', select: 'name type' },
      { path: 'createdBy', select: 'name' },
    ]);

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/transactions', async (req, res, next) => {
  try {
    const fundId = req.params.id;
    const transfers = await FundTransfer.find({
      $or: [{ fromFund: fundId }, { toFund: fundId }],
    })
      .populate('fromFund', 'name type')
      .populate('toFund', 'name type')
      .populate('createdBy', 'name')
      .sort({ date: -1, createdAt: -1 });
    res.json(transfers);
  } catch (error) {
    next(error);
  }
});

export default router;
