import { Router } from 'express';
import { z } from 'zod';
import { Shareholder } from '../models/Shareholder.js';
import { EquityTransaction } from '../models/EquityTransaction.js';
import { ShareLiability } from '../models/ShareLiability.js';
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
          { $match: { shareholder: sh._id, type: { $in: ['investment', 'collection'] } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const liabilityTotals = await ShareLiability.aggregate([
          { $match: { shareholder: sh._id } },
          { $group: { _id: '$type', total: { $sum: '$amount' } } },
        ]);
        let sharePurchaseOwed = 0;
        let sharePurchasePaid = 0;
        for (const lt of liabilityTotals) {
          if (lt._id === 'purchase') sharePurchaseOwed = lt.total;
          if (lt._id === 'payment') sharePurchasePaid = lt.total;
        }
        return {
          ...sh.toObject(),
          currentEquity: lastTxn?.balanceAfter ?? 0,
          totalInvested: totalInvested[0]?.total ?? 0,
          sharePurchaseOwed,
          sharePurchasePaid,
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
      .populate('user', 'name email role')
      .populate('shareHistory.changedBy', 'name');
    if (!shareholder) throw new AppError(404, 'Shareholder not found');

    const transactions = await EquityTransaction.find({ shareholder: shareholder._id })
      .sort({ date: -1, createdAt: -1 })
      .populate('createdBy', 'name');

    res.json({ shareholder, transactions });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const shareholder = await Shareholder.findById(req.params.id)
      .populate('shareHistory.changedBy', 'name');
    if (!shareholder) throw new AppError(404, 'Shareholder not found');
    res.json(shareholder.shareHistory);
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

router.post('/transfer', async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role !== 'admin') throw new AppError(403, 'Admin only');
    const data = z.object({
      from: z.string().min(1),
      to: z.string().min(1),
      percent: z.number().positive().max(100),
      reason: z.string().optional().default(''),
    }).parse(req.body);

    if (data.from === data.to) throw new AppError(400, 'Cannot transfer to the same shareholder');

    const fromSh = await Shareholder.findById(data.from);
    if (!fromSh) throw new AppError(404, 'Source shareholder not found');

    const toSh = await Shareholder.findById(data.to);
    if (!toSh) throw new AppError(404, 'Destination shareholder not found');

    if (fromSh.sharePercent < data.percent) {
      throw new AppError(400, `${fromSh.name} only has ${fromSh.sharePercent.toFixed(2)}% — cannot transfer ${data.percent.toFixed(2)}%`);
    }

    const now = new Date();
    const reasonText = data.reason || `Transfer ${data.percent.toFixed(2)}%`;

    fromSh.shareHistory.push({
      previousPercent: fromSh.sharePercent,
      newPercent: fromSh.sharePercent - data.percent,
      date: now,
      reason: `${reasonText} (transferred to ${toSh.name})`,
      changedBy: req.user!._id,
    } as any);
    fromSh.sharePercent -= data.percent;

    toSh.shareHistory.push({
      previousPercent: toSh.sharePercent,
      newPercent: toSh.sharePercent + data.percent,
      date: now,
      reason: `${reasonText} (received from ${fromSh.name})`,
      changedBy: req.user!._id,
    } as any);
    toSh.sharePercent += data.percent;

    await fromSh.save();
    await toSh.save();

    res.json({ from: fromSh, to: toSh });
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
      reason: z.string().optional(),
    }).parse(req.body);

    const shareholder = await Shareholder.findById(req.params.id);
    if (!shareholder) throw new AppError(404, 'Shareholder not found');

    if (data.sharePercent !== undefined && data.sharePercent !== shareholder.sharePercent) {
      shareholder.shareHistory.push({
        previousPercent: shareholder.sharePercent,
        newPercent: data.sharePercent,
        date: new Date(),
        reason: data.reason || '',
        changedBy: req.user!._id,
      } as any);
      shareholder.sharePercent = data.sharePercent;
    }

    if (data.name !== undefined) shareholder.name = data.name;
    if (data.active !== undefined) shareholder.active = data.active;

    await shareholder.save();
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

router.get('/:id/liabilities', async (req, res, next) => {
  try {
    const entries = await ShareLiability.find({ shareholder: req.params.id })
      .populate('createdBy', 'name')
      .sort({ date: -1, createdAt: -1 });
    res.json(entries);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/liabilities', async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role !== 'admin') throw new AppError(403, 'Admin only');
    const data = z.object({
      type: z.enum(['purchase', 'payment']),
      amount: z.number().int().positive(),
      date: z.string(),
      description: z.string().optional().default(''),
    }).parse(req.body);

    const shareholder = await Shareholder.findById(req.params.id);
    if (!shareholder) throw new AppError(404, 'Shareholder not found');

    const entry = await ShareLiability.create({
      shareholder: shareholder._id,
      type: data.type,
      amount: data.amount,
      date: new Date(data.date),
      description: data.description,
      createdBy: req.user!._id,
    });

    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

router.put('/:id/liabilities/:entryId', async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role !== 'admin') throw new AppError(403, 'Admin only');
    const data = z.object({
      amount: z.number().int().positive().optional(),
      date: z.string().optional(),
      description: z.string().optional(),
    }).parse(req.body);

    const update: Record<string, unknown> = {};
    if (data.amount !== undefined) update.amount = data.amount;
    if (data.date !== undefined) update.date = new Date(data.date);
    if (data.description !== undefined) update.description = data.description;

    const entry = await ShareLiability.findOneAndUpdate(
      { _id: req.params.entryId, shareholder: req.params.id },
      update,
      { new: true },
    ).populate('createdBy', 'name');
    if (!entry) throw new AppError(404, 'Liability entry not found');
    res.json(entry);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/liabilities/:entryId', async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role !== 'admin') throw new AppError(403, 'Admin only');
    const entry = await ShareLiability.findOneAndDelete({
      _id: req.params.entryId,
      shareholder: req.params.id,
    });
    if (!entry) throw new AppError(404, 'Liability entry not found');
    res.json({ message: 'Liability entry deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
