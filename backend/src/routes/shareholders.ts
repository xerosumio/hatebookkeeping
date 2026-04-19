import { Router } from 'express';
import { z } from 'zod';
import { Shareholder } from '../models/Shareholder.js';
import { EquityTransaction } from '../models/EquityTransaction.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req, res, next) => {
  try {
    const shareholders = await Shareholder.find({ active: true })
      .populate('user', 'name email role')
      .sort({ sharePercent: -1 });

    const result = await Promise.all(
      shareholders.map(async (sh) => {
        const lastTxn = await EquityTransaction.findOne({ shareholder: sh._id })
          .sort({ date: -1, createdAt: -1 });
        const totalInvested = await EquityTransaction.aggregate([
          { $match: { shareholder: sh._id, type: 'investment' } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        return {
          ...sh.toObject(),
          currentEquity: lastTxn?.balanceAfter ?? 0,
          totalInvested: totalInvested[0]?.total ?? 0,
        };
      }),
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/summary', async (_req, res, next) => {
  try {
    const shareholders = await Shareholder.find({ active: true });
    const totals = await EquityTransaction.aggregate([
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);
    const totalByType: Record<string, number> = {};
    for (const t of totals) totalByType[t._id] = t.total;

    const perShareholder = await Promise.all(
      shareholders.map(async (sh) => {
        const lastTxn = await EquityTransaction.findOne({ shareholder: sh._id })
          .sort({ date: -1, createdAt: -1 });
        return {
          _id: sh._id,
          name: sh.name,
          sharePercent: sh.sharePercent,
          currentEquity: lastTxn?.balanceAfter ?? 0,
        };
      }),
    );

    res.json({
      totalInvested: totalByType.investment || 0,
      totalDistributed: Math.abs(totalByType.distribution || 0),
      totalCollected: totalByType.collection || 0,
      shareholders: perShareholder,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const shareholder = await Shareholder.findById(req.params.id)
      .populate('user', 'name email role');
    if (!shareholder) throw new AppError(404, 'Shareholder not found');

    const transactions = await EquityTransaction.find({ shareholder: shareholder._id })
      .sort({ date: -1, createdAt: -1 })
      .populate('createdBy', 'name');

    res.json({ shareholder, transactions });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role !== 'admin') throw new AppError(403, 'Admin only');
    const data = z.object({
      user: z.string().min(1),
      name: z.string().min(1),
      sharePercent: z.number().min(0).max(100),
    }).parse(req.body);
    const shareholder = await Shareholder.create(data);
    res.status(201).json(shareholder);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role !== 'admin') throw new AppError(403, 'Admin only');
    const data = z.object({
      name: z.string().min(1).optional(),
      sharePercent: z.number().min(0).max(100).optional(),
      active: z.boolean().optional(),
    }).parse(req.body);
    const shareholder = await Shareholder.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!shareholder) throw new AppError(404, 'Shareholder not found');
    res.json(shareholder);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/invest', async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role !== 'admin') throw new AppError(403, 'Admin only');
    const data = z.object({
      amount: z.number().int().positive(),
      date: z.string(),
      description: z.string().optional().default('Capital investment'),
    }).parse(req.body);

    const shareholder = await Shareholder.findById(req.params.id);
    if (!shareholder) throw new AppError(404, 'Shareholder not found');

    const lastTxn = await EquityTransaction.findOne({ shareholder: shareholder._id })
      .sort({ date: -1, createdAt: -1 });
    const currentBalance = lastTxn?.balanceAfter ?? 0;

    const txn = await EquityTransaction.create({
      type: 'investment',
      shareholder: shareholder._id,
      amount: data.amount,
      date: new Date(data.date),
      description: data.description,
      balanceAfter: currentBalance + data.amount,
      createdBy: req.user!._id,
    });

    res.status(201).json(txn);
  } catch (error) {
    next(error);
  }
});

export default router;
