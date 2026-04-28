import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { MonthlyClose } from '../models/MonthlyClose.js';
import { Transaction } from '../models/Transaction.js';
import { Shareholder } from '../models/Shareholder.js';
import { EquityTransaction } from '../models/EquityTransaction.js';
import { Payee } from '../models/Payee.js';
import { PaymentRequest } from '../models/PaymentRequest.js';
import { Fund } from '../models/Fund.js';
import { FundTransfer } from '../models/FundTransfer.js';
import { getNextSequence } from '../models/Counter.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authMiddleware);

async function computeMonthlyFigures(year: number, month: number, entityId: string) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const NON_OPERATIONAL_CATEGORIES = ['Currency Conversion'];
  const results = await Transaction.aggregate([
    { $addFields: { _effectiveDate: { $ifNull: ['$accountingDate', '$date'] } } },
    { $match: { _effectiveDate: { $gte: startDate, $lt: endDate }, category: { $nin: NON_OPERATIONAL_CATEGORIES }, entity: new mongoose.Types.ObjectId(entityId) } },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ]);

  let totalIncome = 0;
  let totalExpense = 0;
  for (const r of results) {
    if (r._id === 'income') totalIncome = r.total;
    if (r._id === 'expense') totalExpense = r.total;
  }

  return { totalIncome, totalExpense, netProfit: totalIncome - totalExpense };
}

function computeDistribution(netProfit: number, shareholders: Array<{ _id: any; sharePercent: number }>) {
  const isLoss = netProfit < 0;
  let shareholderPool = 0;
  let companyReserve = 0;
  let staffReserve = 0;

  if (!isLoss) {
    shareholderPool = Math.round(netProfit * 0.75);
    companyReserve = Math.round(netProfit * 0.20);
    staffReserve = netProfit - shareholderPool - companyReserve;
  } else {
    shareholderPool = netProfit;
  }

  const distributions = shareholders.map((sh) => ({
    shareholder: sh._id,
    sharePercent: sh.sharePercent,
    amount: Math.round(Math.abs(shareholderPool) * sh.sharePercent / 100) * (isLoss ? -1 : 1),
  }));

  const distributedTotal = distributions.reduce((sum, d) => sum + Math.abs(d.amount), 0);
  const remainder = Math.abs(shareholderPool) - distributedTotal;
  if (remainder !== 0 && distributions.length > 0) {
    const sign = isLoss ? -1 : 1;
    distributions[0].amount += remainder * sign;
  }

  return { shareholderPool: Math.abs(shareholderPool), companyReserve, staffReserve, isLoss, distributions };
}

// List all closes, optionally filter by entity
router.get('/', async (req, res, next) => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.query.entity) filter.entity = req.query.entity;
    const closes = await MonthlyClose.find(filter)
      .sort({ year: -1, month: -1 })
      .populate('closedBy', 'name')
      .populate('entity', 'code name');
    res.json(closes);
  } catch (error) {
    next(error);
  }
});

// Group summary for a year/month across all entities
router.get('/summary/:year/:month', async (req, res, next) => {
  try {
    const year = parseInt(req.params.year as string);
    const month = parseInt(req.params.month as string);
    const closes = await MonthlyClose.find({ year, month })
      .populate('entity', 'code name');
    const totalIncome = closes.reduce((s, c) => s + c.totalIncome, 0);
    const totalExpense = closes.reduce((s, c) => s + c.totalExpense, 0);
    res.json({
      year,
      month,
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      entities: closes.map((c) => ({
        entity: c.entity,
        totalIncome: c.totalIncome,
        totalExpense: c.totalExpense,
        netProfit: c.netProfit,
        status: c.status,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:entity/:year/:month', async (req, res, next) => {
  try {
    const entityId = req.params.entity as string;
    const year = parseInt(req.params.year as string);
    const month = parseInt(req.params.month as string);
    const existing = await MonthlyClose.findOne({ entity: entityId, year, month })
      .populate('distributions.shareholder', 'name sharePercent')
      .populate('closedBy', 'name')
      .populate('entity', 'code name');
    if (existing) return res.json(existing);

    const figures = await computeMonthlyFigures(year, month, entityId);
    const shareholders = await Shareholder.find({ active: true }).sort({ sharePercent: -1 });
    const dist = computeDistribution(figures.netProfit, shareholders);

    res.json({
      entity: entityId,
      year,
      month,
      status: 'draft',
      ...figures,
      shareholderDistribution: dist.shareholderPool,
      companyReserve: dist.companyReserve,
      staffReserve: dist.staffReserve,
      isLoss: dist.isLoss,
      distributions: dist.distributions.map((d) => {
        const sh = shareholders.find((s) => s._id.equals(d.shareholder));
        return { ...d, shareholder: { _id: sh!._id, name: sh!.name, sharePercent: sh!.sharePercent } };
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:entity/:year/:month/preview', async (req, res, next) => {
  try {
    const entityId = req.params.entity as string;
    const year = parseInt(req.params.year as string);
    const month = parseInt(req.params.month as string);

    const figures = await computeMonthlyFigures(year, month, entityId);
    const shareholders = await Shareholder.find({ active: true }).sort({ sharePercent: -1 });
    const dist = computeDistribution(figures.netProfit, shareholders);

    res.json({
      entity: entityId,
      year,
      month,
      ...figures,
      shareholderDistribution: dist.shareholderPool,
      companyReserve: dist.companyReserve,
      staffReserve: dist.staffReserve,
      isLoss: dist.isLoss,
      distributions: dist.distributions.map((d) => {
        const sh = shareholders.find((s) => s._id.equals(d.shareholder));
        return { ...d, shareholder: { _id: sh!._id, name: sh!.name, sharePercent: sh!.sharePercent } };
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:entity/:year/:month/finalize', async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role !== 'admin') throw new AppError(403, 'Admin only');

    const entityId = req.params.entity as string;
    const year = parseInt(req.params.year as string);
    const month = parseInt(req.params.month as string);
    const { notes } = z.object({ notes: z.string().optional().default('') }).parse(req.body);

    const existing = await MonthlyClose.findOne({ entity: entityId, year, month });
    if (existing?.status === 'finalized') throw new AppError(400, 'Month already finalized');

    const figures = await computeMonthlyFigures(year, month, entityId);
    const shareholders = await Shareholder.find({ active: true }).sort({ sharePercent: -1 });
    const dist = computeDistribution(figures.netProfit, shareholders);

    const closeDoc = existing
      ? await MonthlyClose.findByIdAndUpdate(existing._id, {
          ...figures,
          shareholderDistribution: dist.shareholderPool,
          companyReserve: dist.companyReserve,
          staffReserve: dist.staffReserve,
          isLoss: dist.isLoss,
          status: 'finalized',
          closedBy: req.user!._id,
          closedAt: new Date(),
          notes,
        }, { new: true })
      : await MonthlyClose.create({
          entity: entityId,
          year,
          month,
          ...figures,
          shareholderDistribution: dist.shareholderPool,
          companyReserve: dist.companyReserve,
          staffReserve: dist.staffReserve,
          isLoss: dist.isLoss,
          status: 'finalized',
          closedBy: req.user!._id,
          closedAt: new Date(),
          notes,
          distributions: [],
        });

    const distributions = [];
    for (const d of dist.distributions) {
      const lastTxn = await EquityTransaction.findOne({ shareholder: d.shareholder })
        .sort({ date: -1, createdAt: -1 });
      const currentBalance = lastTxn?.balanceAfter ?? 0;

      const eqType = dist.isLoss ? 'collection' : 'distribution';
      const amount = dist.isLoss ? Math.abs(d.amount) : -Math.abs(d.amount);
      const balanceAfter = currentBalance + amount;

      const sh = shareholders.find((s) => s._id.equals(d.shareholder));
      const monthName = new Date(year, month - 1).toLocaleString('en', { month: 'long' });
      const description = dist.isLoss
        ? `Capital collection — ${monthName} ${year} loss`
        : `Profit distribution — ${monthName} ${year}`;

      const eqTxn = await EquityTransaction.create({
        type: eqType,
        shareholder: d.shareholder,
        amount,
        date: new Date(year, month - 1, 28),
        description,
        monthlyClose: closeDoc!._id,
        balanceAfter,
        createdBy: req.user!._id,
      });

      distributions.push({
        shareholder: d.shareholder,
        sharePercent: d.sharePercent,
        amount: d.amount,
        equityTransaction: eqTxn._id,
      });
    }

    closeDoc!.distributions = distributions;
    await closeDoc!.save();

    // Auto-create fund transfers for reserves (profit scenario)
    if (!dist.isLoss && dist.companyReserve > 0) {
      const companyReserveFund = await Fund.findOne({ name: 'Company Reserve' });
      if (companyReserveFund) {
        await Fund.findByIdAndUpdate(companyReserveFund._id, { $inc: { balance: dist.companyReserve } });
        await FundTransfer.create({
          toFund: companyReserveFund._id,
          amount: dist.companyReserve,
          date: new Date(year, month - 1, 28),
          description: `Company reserve allocation — ${new Date(year, month - 1).toLocaleString('en', { month: 'long' })} ${year}`,
          reference: `monthly-close:${closeDoc!._id}`,
          createdBy: req.user!._id,
        });
      }
    }
    if (!dist.isLoss && dist.staffReserve > 0) {
      const staffReserveFund = await Fund.findOne({ name: 'Staff Reserve' });
      if (staffReserveFund) {
        await Fund.findByIdAndUpdate(staffReserveFund._id, { $inc: { balance: dist.staffReserve } });
        await FundTransfer.create({
          toFund: staffReserveFund._id,
          amount: dist.staffReserve,
          date: new Date(year, month - 1, 28),
          description: `Staff reserve allocation — ${new Date(year, month - 1).toLocaleString('en', { month: 'long' })} ${year}`,
          reference: `monthly-close:${closeDoc!._id}`,
          createdBy: req.user!._id,
        });
      }
    }

    const result = await MonthlyClose.findById(closeDoc!._id)
      .populate('distributions.shareholder', 'name sharePercent')
      .populate('closedBy', 'name')
      .populate('entity', 'code name');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/:entity/:year/:month/create-collection-requests', async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role !== 'admin') throw new AppError(403, 'Admin only');

    const entityId = req.params.entity as string;
    const year = parseInt(req.params.year as string);
    const month = parseInt(req.params.month as string);

    const close = await MonthlyClose.findOne({ entity: entityId, year, month, status: 'finalized' })
      .populate('distributions.shareholder');
    if (!close) throw new AppError(404, 'No finalized close for this month');
    if (!close.isLoss) throw new AppError(400, 'Month is not a loss — no collection needed');

    const items = [];
    for (const d of close.distributions) {
      const sh = d.shareholder as any;
      let payee = await Payee.findOne({ name: sh.name });
      if (!payee) {
        payee = await Payee.create({
          name: sh.name,
          bankName: '',
          bankAccountNumber: '',
          bankCode: '',
          notes: 'Shareholder',
          createdBy: req.user!._id,
        });
      }
      items.push({
        payee: payee._id,
        description: `Capital collection — ${sh.name} (${d.sharePercent.toFixed(2)}%)`,
        amount: Math.abs(d.amount),
        category: 'Shareholder Collection',
      });
    }

    const requestNumber = await getNextSequence('pay');
    const monthName = new Date(year, month - 1).toLocaleString('en', { month: 'long' });
    const pr = await PaymentRequest.create({
      requestNumber,
      description: `Shareholder capital collection — ${monthName} ${year} loss`,
      items,
      totalAmount: items.reduce((sum, i) => sum + i.amount, 0),
      sourceBankAccount: '',
      status: 'pending',
      entity: entityId,
      createdBy: req.user!._id,
      activityLog: [{ action: 'created', user: req.user!._id, timestamp: new Date() }],
    });

    res.status(201).json(pr);
  } catch (error) {
    next(error);
  }
});

export default router;
