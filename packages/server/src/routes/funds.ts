import { Router } from 'express';
import { z } from 'zod';
import { Fund } from '../models/Fund.js';
import { FundTransfer } from '../models/FundTransfer.js';
import { Transaction } from '../models/Transaction.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { assertAdjustFund, requirePage } from '../access/policy.js';
import { AppError } from '../middleware/errorHandler.js';
import { reconstructFundBalances } from '../utils/fundBalance.js';
import { FUND_NAME, type EntityKey } from '../config/bankAccounts.js';
import { getBalances } from '../services/airwallex.js';
import { hkInstant, parseYmd } from '../utils/hkDate.js';

const AIRWALLEX_FUND: Record<string, EntityKey> = {
  [FUND_NAME.ax]: 'ax',
  [FUND_NAME.nt]: 'nt',
};

/** Live HKD total from Airwallex, in cents. Null when that account cannot be read. */
async function liveAirwallexBalances(): Promise<Map<string, number | null>> {
  const entries = await Promise.all(
    Object.entries(AIRWALLEX_FUND).map(async ([name, entity]) => {
      try {
        const balances = await getBalances(entity);
        const hkd = balances.find((row) => row.currency === 'HKD');
        return [name, hkd ? Math.round(hkd.total_amount * 100) : null] as const;
      } catch {
        return [name, null] as const;
      }
    }),
  );
  return new Map(entries);
}

async function liveAirwallexBalance(fundName: string): Promise<number | null> {
  const entity = AIRWALLEX_FUND[fundName];
  if (!entity) return null;
  try {
    const balances = await getBalances(entity);
    const hkd = balances.find((row) => row.currency === 'HKD');
    return hkd ? Math.round(hkd.total_amount * 100) : null;
  } catch {
    return null;
  }
}

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
router.use(requirePage('funds'));

router.get('/', async (_req, res, next) => {
  try {
    const funds = await Fund.find().populate('entity', 'code name').populate('heldIn', 'name type').sort({ type: 1, name: 1 });
    const [reconstructed, airwallex] = await Promise.all([
      reconstructFundBalances(funds),
      liveAirwallexBalances(),
    ]);
    res.json(funds.map((fund) => {
      const obj = fund.toObject();
      const reconstructedBalance = reconstructed.get(String(fund._id)) ?? fund.openingBalance;
      if (fund.name in AIRWALLEX_FUND) {
        const live = airwallex.get(fund.name) ?? null;
        return {
          ...obj,
          reconstructedBalance,
          airwallexBalance: live,
          driftKind: 'airwallex' as const,
          ...(live == null ? {} : { drift: (fund.balance || 0) - live }),
        };
      }
      return {
        ...obj,
        reconstructedBalance,
        driftKind: 'ledger' as const,
        drift: (fund.balance || 0) - reconstructedBalance,
      };
    }));
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

router.post('/:id/adjust', async (req: AuthRequest, res, next) => {
  try {
    await assertAdjustFund(req);
    const data = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      note: z.string().optional(),
    }).parse(req.body);

    const fund = await Fund.findById(req.params.id);
    if (!fund) throw new AppError(404, 'Fund not found');
    if (!(fund.name in AIRWALLEX_FUND)) {
      throw new AppError(400, 'Only an Airwallex bank fund can be adjusted to the live balance');
    }

    const live = await liveAirwallexBalance(fund.name);
    if (live == null) throw new AppError(502, 'Airwallex balance is unavailable');

    const reconstructed = await reconstructFundBalances([fund]);
    const historyEnd = reconstructed.get(String(fund._id)) ?? fund.openingBalance;
    const delta = live - historyEnd;

    let date: Date;
    try {
      const parts = parseYmd(data.date);
      date = hkInstant(parts.year, parts.month, parts.day);
    } catch {
      throw new AppError(400, 'date must be YYYY-MM-DD');
    }

    if (delta !== 0) {
      await FundTransfer.create({
        fromFund: delta < 0 ? fund._id : undefined,
        toFund: delta > 0 ? fund._id : undefined,
        amount: Math.abs(delta),
        date,
        description: data.note?.trim() || 'Balance adjustment to match Airwallex',
        reference: 'airwallex-adjustment',
        createdBy: req.user!._id,
      });
    }

    fund.balance = live;
    await fund.save();

    res.json({
      balance: fund.balance,
      historyEnd,
      airwallexBalance: live,
      transferAmount: delta,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/transactions', async (req, res, next) => {
  try {
    const fundId = req.params.id;
    const fund = await Fund.findById(fundId);
    if (!fund) throw new AppError(404, 'Fund not found');

    const [transfers, transactions] = await Promise.all([
      FundTransfer.find({ $or: [{ fromFund: fundId }, { toFund: fundId }] })
        .populate('fromFund', 'name type')
        .populate('toFund', 'name type')
        .lean(),
      Transaction.find({ bankAccount: fund.name })
        .select('date type category description amount bankReference createdAt')
        .lean(),
    ]);

    interface LedgerEntry {
      _id: string;
      date: string;
      createdAt: string;
      description: string;
      amount: number;
      type: 'transfer' | 'transaction';
      direction: string;
      reference?: string;
      runningBalance: number;
    }

    const entries: LedgerEntry[] = [];

    for (const t of transfers) {
      const isInflow = t.toFund && String((t.toFund as any)._id ?? t.toFund) === fundId;
      const signed = isInflow ? t.amount : -t.amount;
      const fromName = t.fromFund && typeof t.fromFund === 'object' ? (t.fromFund as any).name : 'External';
      const toName = t.toFund && typeof t.toFund === 'object' ? (t.toFund as any).name : 'External';
      entries.push({
        _id: String(t._id),
        date: new Date(t.date).toISOString(),
        createdAt: new Date(t.createdAt).toISOString(),
        description: t.description,
        amount: signed,
        type: 'transfer',
        direction: isInflow ? `From ${fromName}` : `To ${toName}`,
        reference: t.reference || undefined,
        runningBalance: 0,
      });
    }

    for (const tx of transactions) {
      const signed = tx.type === 'income' ? tx.amount : -tx.amount;
      entries.push({
        _id: String(tx._id),
        date: new Date(tx.date).toISOString(),
        createdAt: new Date(tx.createdAt).toISOString(),
        description: tx.description,
        amount: signed,
        type: 'transaction',
        direction: tx.type === 'income' ? `Income — ${tx.category}` : `Expense — ${tx.category}`,
        reference: tx.bankReference || undefined,
        runningBalance: 0,
      });
    }

    entries.sort((a, b) => {
      const d = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (d !== 0) return d;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    let balance = fund.openingBalance;
    for (const e of entries) {
      balance += e.amount;
      e.runningBalance = balance;
    }

    entries.reverse();

    res.json({ openingBalance: fund.openingBalance, entries });
  } catch (error) {
    next(error);
  }
});

export default router;
