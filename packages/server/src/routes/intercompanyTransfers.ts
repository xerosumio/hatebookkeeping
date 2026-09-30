import { Router } from 'express';
import { z } from 'zod';
import { Transaction } from '../models/Transaction.js';
import { adjustFundBalance } from '../utils/fundBalance.js';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authMiddleware);

const CATEGORY = 'Intercompany Transfer';

const transferSchema = z.object({
  fromEntity: z.string().min(1),
  toEntity: z.string().min(1),
  amount: z.number().int().positive(),
  date: z.string(),
  description: z.string().min(1),
  fromBankAccount: z.string().optional().default(''),
  toBankAccount: z.string().optional().default(''),
});

// List intercompany transfers (transactions with category "Intercompany Transfer")
router.get('/', async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ category: CATEGORY })
      .populate('entity', 'code name')
      .sort({ date: -1 });
    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

// Create intercompany transfer — creates paired transactions on both entities
router.post('/', roleGuard('admin', 'user'), async (req: AuthRequest, res, next) => {
  try {
    const data = transferSchema.parse(req.body);

    if (data.fromEntity === data.toEntity) {
      throw new AppError(400, 'Source and destination entities must be different');
    }

    const date = new Date(data.date);

    // Create expense on source entity
    const expenseTxn = await Transaction.create({
      date,
      type: 'expense',
      category: CATEGORY,
      description: data.description,
      amount: data.amount,
      entity: data.fromEntity,
      bankAccount: data.fromBankAccount,
      createdBy: req.user!._id,
    });

    // Create income on destination entity
    const incomeTxn = await Transaction.create({
      date,
      type: 'income',
      category: CATEGORY,
      description: data.description,
      amount: data.amount,
      entity: data.toEntity,
      bankAccount: data.toBankAccount,
      createdBy: req.user!._id,
    });

    // Adjust fund balances
    if (data.fromBankAccount) {
      await adjustFundBalance(data.fromBankAccount, -data.amount);
    }
    if (data.toBankAccount) {
      await adjustFundBalance(data.toBankAccount, data.amount);
    }

    const populated = await Transaction.find({ _id: { $in: [expenseTxn._id, incomeTxn._id] } })
      .populate('entity', 'code name');

    res.status(201).json({
      expense: populated.find((t) => t.type === 'expense'),
      income: populated.find((t) => t.type === 'income'),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
