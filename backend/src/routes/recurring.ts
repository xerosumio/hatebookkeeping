import { Router } from 'express';
import { z } from 'zod';
import { RecurringItem } from '../models/RecurringItem.js';
import { Transaction } from '../models/Transaction.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authMiddleware);

const recurringSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1),
  amount: z.number().int().positive(),
  frequency: z.enum(['monthly', 'quarterly', 'yearly']),
  client: z.string().optional(),
  description: z.string().optional().default(''),
  startDate: z.string(),
  endDate: z.string().optional(),
  active: z.boolean().optional().default(true),
});

router.get('/', async (_req, res, next) => {
  try {
    const items = await RecurringItem.find()
      .populate('client', 'name')
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = recurringSchema.parse(req.body);
    const item = await RecurringItem.create({
      ...data,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      createdBy: req.user!._id,
    });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const data = recurringSchema.parse(req.body);
    const item = await RecurringItem.findByIdAndUpdate(
      req.params.id,
      {
        ...data,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      { new: true },
    );
    if (!item) throw new AppError(404, 'Recurring item not found');
    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const item = await RecurringItem.findByIdAndDelete(req.params.id);
    if (!item) throw new AppError(404, 'Recurring item not found');
    res.json({ message: 'Recurring item deleted' });
  } catch (error) {
    next(error);
  }
});

// Generate transactions for current month
router.post('/generate', async (req: AuthRequest, res, next) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const items = await RecurringItem.find({
      active: true,
      startDate: { $lte: monthEnd },
      $or: [{ endDate: null }, { endDate: { $gte: monthStart } }],
    });

    const generated = [];
    for (const item of items) {
      // Skip if already generated for this month
      if (item.lastGeneratedDate && item.lastGeneratedDate >= monthStart) continue;

      // Check frequency
      const monthsSinceStart = (now.getFullYear() - item.startDate.getFullYear()) * 12 +
        (now.getMonth() - item.startDate.getMonth());

      let shouldGenerate = false;
      if (item.frequency === 'monthly') shouldGenerate = true;
      else if (item.frequency === 'quarterly') shouldGenerate = monthsSinceStart % 3 === 0;
      else if (item.frequency === 'yearly') shouldGenerate = monthsSinceStart % 12 === 0;

      if (!shouldGenerate) continue;

      const transaction = await Transaction.create({
        date: now,
        type: item.type,
        category: item.category,
        description: `[Recurring] ${item.name}${item.description ? ' — ' + item.description : ''}`,
        amount: item.amount,
        reconciled: false,
        createdBy: req.user!._id,
      });

      item.lastGeneratedDate = now;
      await item.save();
      generated.push(transaction);
    }

    res.json({ generated: generated.length, transactions: generated });
  } catch (error) {
    next(error);
  }
});

export default router;
