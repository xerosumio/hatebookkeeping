import { Router } from 'express';
import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction.js';
import { Invoice } from '../models/Invoice.js';
import { PaymentRequest } from '../models/PaymentRequest.js';
import { RecurringItem } from '../models/RecurringItem.js';
import { Shareholder } from '../models/Shareholder.js';
import { ShareBonusUser } from '../models/ShareBonusUser.js';
import { authMiddleware } from '../middleware/auth.js';
import { requirePage } from '../access/policy.js';
import {
  hkAllTimeBounds,
  hkDayBounds,
  hkInclusiveRange,
  hkMonthBounds,
} from '../utils/hkDate.js';
import {
  MONTH_PLAN_INVOICE_STATUSES,
  MONTH_PLAN_OPEN_INVOICE_STATUSES,
  MONTH_PLAN_OPEN_REQUEST_STATUSES,
  MONTH_PLAN_REQUEST_STATUSES,
  PlanBoundsError,
  buildMonthPlan,
  resolvePlanBounds,
  type MonthPlanSourceInvoice,
  type MonthPlanSourceRequest,
} from '../services/monthPlan.js';
import {
  monthlyFigures,
  monthlyFiguresAllEntities,
  operatingCashSnapshot,
  queryCash,
  queryPl,
  queryPlByCategory,
} from '../services/periodFigures.js';
import { splitTakeOut, unpaidBankTotal } from '../services/takeOut.js';

const router = Router();
router.use(authMiddleware);
router.use((req, res, next) => {
  const dashboardReads = new Set(['/cash-flow', '/accounts-receivable', '/recurring-overview']);
  if (req.method === 'GET' && dashboardReads.has(req.path)) {
    return requirePage('reports', 'dashboard')(req, res, next);
  }
  return requirePage('reports')(req, res, next);
});

const AR_OPEN_STATUSES = ['unpaid', 'partial'] as const;
const AP_OPEN_STATUSES = ['pending', 'approved'] as const;

function entityIdFromQuery(req: { query: Record<string, unknown> }): string | undefined {
  const entity = req.query.entity;
  return typeof entity === 'string' && entity.length > 0 ? entity : undefined;
}

function entityObjectId(entityId?: string) {
  return entityId ? { entity: new mongoose.Types.ObjectId(entityId) } : {};
}

function populatedName(value: unknown): string {
  if (value && typeof value === 'object' && 'name' in value && typeof (value as { name: unknown }).name === 'string') {
    return (value as { name: string }).name;
  }
  return '';
}

function periodFromQuery(req: { query: Record<string, unknown> }): { from: Date; to: Date } {
  const start = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
  const end = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
  if (start && end) return hkInclusiveRange(start, end);
  if (start) return { from: hkDayBounds(start).from, to: hkAllTimeBounds().to };
  if (end) return { from: hkAllTimeBounds().from, to: hkDayBounds(end).to };
  return hkAllTimeBounds();
}

async function liveArAp(entityId?: string) {
  const entityMatch = entityObjectId(entityId);
  const [arResult, apResult] = await Promise.all([
    Invoice.aggregate([
      { $match: { status: { $in: [...AR_OPEN_STATUSES] }, ...entityMatch } },
      { $group: { _id: null, total: { $sum: '$amountDue' }, count: { $sum: 1 } } },
    ]),
    PaymentRequest.aggregate([
      { $match: { status: { $in: [...AP_OPEN_STATUSES] }, ...entityMatch } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),
  ]);
  return {
    accountsReceivable: { total: arResult[0]?.total || 0, count: arResult[0]?.count || 0 },
    accountsPayable: { total: apResult[0]?.total || 0, count: apResult[0]?.count || 0 },
  };
}

router.get('/cash-flow', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const entityId = entityIdFromQuery(req);

    const months = await Promise.all(
      Array.from({ length: 12 }, async (_, i) => {
        const month = i + 1;
        const { from, to } = hkMonthBounds(year, month);
        const [pl, cash] = await Promise.all([
          queryPl({ from, to, entityId }),
          queryCash({ from, to, entityId }),
        ]);
        return {
          month,
          income: pl.income,
          expense: pl.expense,
          net: pl.net,
          cashIn: cash.cashIn,
          cashOut: cash.cashOut,
          cashNet: cash.cashNet,
        };
      }),
    );

    const totals = months.reduce(
      (s, m) => ({
        income: s.income + m.income,
        expense: s.expense + m.expense,
        net: s.net + m.net,
        cashIn: s.cashIn + m.cashIn,
        cashOut: s.cashOut + m.cashOut,
        cashNet: s.cashNet + m.cashNet,
      }),
      { income: 0, expense: 0, net: 0, cashIn: 0, cashOut: 0, cashNet: 0 },
    );

    res.json({ year, months, totals });
  } catch (error) {
    next(error);
  }
});

router.get('/accounts-receivable', async (req, res, next) => {
  try {
    const filter: Record<string, unknown> = { status: { $in: [...AR_OPEN_STATUSES] } };
    const entityId = entityIdFromQuery(req);
    if (entityId) filter.entity = entityId;

    if (req.query.startDate || req.query.endDate) {
      const { from, to } = periodFromQuery(req);
      filter.dueDate = { $gte: from, $lt: to };
    }

    const invoices = await Invoice.find(filter)
      .populate('client', 'name')
      .sort({ dueDate: 1, createdAt: -1 });

    const now = new Date();
    const totalDue = invoices.reduce((sum, inv) => sum + inv.amountDue, 0);
    const overdue = invoices.filter((inv) => inv.dueDate && new Date(inv.dueDate) < now);

    res.json({
      invoices,
      summary: {
        totalDue,
        count: invoices.length,
        overdueCount: overdue.length,
        overdueDue: overdue.reduce((sum, inv) => sum + inv.amountDue, 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/recurring-overview', async (_req, res, next) => {
  try {
    const items = await RecurringItem.find({ active: true }).populate('client', 'name');

    const prorate = (item: { frequency: string; amount: number }) => {
      if (item.frequency === 'monthly') return item.amount;
      if (item.frequency === 'quarterly') return Math.round(item.amount / 3);
      if (item.frequency === 'yearly') return Math.round(item.amount / 12);
      return 0;
    };

    const monthlyIncome = items
      .filter((i) => i.type === 'income')
      .reduce((sum, i) => sum + prorate(i), 0);
    const monthlyExpense = items
      .filter((i) => i.type === 'expense')
      .reduce((sum, i) => sum + prorate(i), 0);

    res.json({
      items,
      summary: {
        monthlyIncome,
        monthlyExpense,
        monthlyNet: monthlyIncome - monthlyExpense,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/income-statement', async (req, res, next) => {
  try {
    const { from, to } = periodFromQuery(req);
    const entityId = entityIdFromQuery(req);
    const data = await queryPlByCategory({ from, to, entityId });
    res.json({
      period: { startDate: from, endDate: to },
      income: data.income,
      expenses: data.expenses,
      totals: data.totals,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/income-statement/transactions', async (req, res, next) => {
  try {
    const { type, category } = req.query;
    if (!type || !category) {
      res.status(400).json({ error: 'type and category are required' });
      return;
    }

    const { from, to } = periodFromQuery(req);
    const entityId = entityIdFromQuery(req);

    const transactions = await Transaction.aggregate([
      { $addFields: { _effectiveDate: { $ifNull: ['$accountingDate', '$date'] } } },
      {
        $match: {
          type: type as string,
          category: category as string,
          _effectiveDate: { $gte: from, $lt: to },
          ...entityObjectId(entityId),
        },
      },
      { $sort: { _effectiveDate: -1 } },
    ]);
    await Transaction.populate(transactions, [
      { path: 'invoice', select: 'invoiceNumber' },
      { path: 'paymentRequest', select: 'requestNumber' },
    ]);

    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

router.get('/accounts-payable', async (req, res, next) => {
  try {
    const filter: Record<string, unknown> = { status: { $in: [...AP_OPEN_STATUSES] } };
    const entityId = entityIdFromQuery(req);
    if (entityId) filter.entity = entityId;

    if (req.query.startDate || req.query.endDate) {
      const { from, to } = periodFromQuery(req);
      filter.$expr = {
        $let: {
          vars: { due: { $ifNull: ['$dueDate', '$createdAt'] } },
          in: { $and: [{ $gte: ['$$due', from] }, { $lt: ['$$due', to] }] },
        },
      };
    }

    const requests = await PaymentRequest.find(filter)
      .populate('items.payee', 'name')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    const totalAmount = requests.reduce((s, r) => s + r.totalAmount, 0);
    const pendingRequests = requests.filter((r) => r.status === 'pending');
    const approvedRequests = requests.filter((r) => r.status === 'approved');
    const pendingAmount = pendingRequests.reduce((s, r) => s + r.totalAmount, 0);
    const approvedAmount = approvedRequests.reduce((s, r) => s + r.totalAmount, 0);

    const categoryMap: Record<string, number> = {};
    for (const row of requests) {
      for (const item of row.items) {
        const cat = item.category || 'Uncategorized';
        categoryMap[cat] = (categoryMap[cat] || 0) + item.amount;
      }
    }
    const categoryBreakdown = Object.entries(categoryMap)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    res.json({
      requests,
      summary: {
        totalAmount,
        count: requests.length,
        pendingAmount,
        pendingCount: pendingRequests.length,
        approvedAmount,
        approvedCount: approvedRequests.length,
      },
      categoryBreakdown,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/balance-sheet', async (req, res, next) => {
  try {
    const entityId = entityIdFromQuery(req);
    const [cash, arAp] = await Promise.all([
      operatingCashSnapshot(entityId),
      liveArAp(entityId),
    ]);

    const cashAssets = cash.operatingCash + cash.standaloneReserves;
    const totalAssets = cashAssets + arAp.accountsReceivable.total;
    const totalLiabilities = arAp.accountsPayable.total;

    res.json({
      asOf: new Date().toISOString(),
      assets: {
        cash: {
          bankPettyTotal: cash.bankPettyTotal,
          earmarkedReserves: cash.earmarkedReserves,
          operatingCash: cash.operatingCash,
          standaloneReserves: cash.standaloneReserves,
          total: cashAssets,
          breakdown: cash.cashBreakdown,
          earmarkedBreakdown: cash.earmarkedBreakdown,
          standaloneBreakdown: cash.standaloneBreakdown,
        },
        accountsReceivable: arAp.accountsReceivable,
        total: totalAssets,
      },
      liabilities: {
        accountsPayable: arAp.accountsPayable,
        total: totalLiabilities,
      },
      netPosition: totalAssets - totalLiabilities,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/monthly-summary', async (req, res, next) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year as string) || now.getFullYear();
    const month = parseInt(req.query.month as string) || (now.getMonth() + 1);
    const entityId = entityIdFromQuery(req);

    const [figures, arAp] = await Promise.all([
      entityId ? monthlyFigures(year, month, entityId) : monthlyFiguresAllEntities(year, month),
      liveArAp(entityId),
    ]);

    res.json({
      period: { year, month },
      live: true,
      openingCash: figures.openingCash,
      operations: {
        income: figures.totalIncome,
        expense: figures.totalExpense,
        net: figures.netProfit,
      },
      cash: {
        cashIn: figures.cashIn,
        cashOut: figures.cashOut,
        cashFlow: figures.cashFlow,
      },
      availableCash: figures.availableCash,
      accountsReceivable: arAp.accountsReceivable,
      accountsPayable: arAp.accountsPayable,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/month-plan', async (req, res, next) => {
  try {
    const yearRaw = parseInt(req.query.year as string, 10);
    const monthRaw = parseInt(req.query.month as string, 10);
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
    let from: Date;
    let to: Date;
    try {
      ({ from, to } = resolvePlanBounds({
        year: Number.isFinite(yearRaw) ? yearRaw : undefined,
        month: Number.isFinite(monthRaw) ? monthRaw : undefined,
        startDate,
        endDate,
      }));
    } catch (error) {
      if (error instanceof PlanBoundsError) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }

    const entityId = entityIdFromQuery(req);
    const entityMatch = entityObjectId(entityId);

    const [invoices, requests, snapshot, shareholders, bonusUsers] = await Promise.all([
      Invoice.find({
        ...entityMatch,
        $or: [
          {
            status: { $in: [...MONTH_PLAN_INVOICE_STATUSES] },
            invoiceDate: { $gte: from, $lt: to },
          },
          {
            status: { $in: [...MONTH_PLAN_OPEN_INVOICE_STATUSES] },
            invoiceDate: { $lt: from },
          },
        ],
      }).populate('client', 'name'),
      PaymentRequest.find({
        ...entityMatch,
        $or: [
          {
            status: { $in: [...MONTH_PLAN_REQUEST_STATUSES] },
            $expr: {
              $let: {
                vars: { due: { $ifNull: ['$dueDate', '$createdAt'] } },
                in: { $and: [{ $gte: ['$$due', from] }, { $lt: ['$$due', to] }] },
              },
            },
          },
          {
            status: { $in: [...MONTH_PLAN_OPEN_REQUEST_STATUSES] },
            $expr: { $lt: [{ $ifNull: ['$dueDate', '$createdAt'] }, from] },
          },
        ],
      }).populate('items.payee', 'name'),
      operatingCashSnapshot(entityId),
      Shareholder.find({ active: true }).sort({ name: 1 }),
      ShareBonusUser.find().sort({ name: 1 }),
    ]);

    const sourceInvoices: MonthPlanSourceInvoice[] = invoices.map((inv) => ({
      id: inv._id.toString(),
      invoiceNumber: inv.invoiceNumber,
      clientName: populatedName(inv.client),
      invoiceDate: inv.invoiceDate,
      total: inv.total,
      amountPaid: inv.amountPaid,
      amountDue: inv.amountDue,
      status: inv.status,
    }));

    const sourceRequests: MonthPlanSourceRequest[] = requests.map((row) => ({
      id: row._id.toString(),
      requestNumber: row.requestNumber,
      description: row.description || row.items[0]?.description || '',
      payeeNames: [...new Set(row.items.map((item) => populatedName(item.payee)).filter(Boolean))],
      createdAt: row.createdAt,
      dueDate: row.dueDate,
      totalAmount: row.totalAmount,
      status: row.status,
      items: row.items.map((item) => ({ category: item.category, amount: item.amount })),
    }));

    const pendingOut = unpaidBankTotal(requests.map((row) => ({
      status: row.status,
      totalAmount: row.totalAmount,
      items: row.items.map((item) => ({
        amount: item.amount,
        disbursementType: item.disbursementType,
      })),
    })));
    const takeOut = splitTakeOut({
      operatingCash: snapshot.operatingCash,
      pendingOut,
      bonuses: bonusUsers.map((person) => ({ name: person.name, percent: person.bonusPercent })),
      shareholders: shareholders.map((person) => ({ name: person.name, sharePercent: person.sharePercent })),
    });

    res.json({
      period: { from, to },
      ...buildMonthPlan(sourceInvoices, sourceRequests, { from, to }),
      takeOut,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/breakeven-analysis', async (req, res, next) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year as string) || now.getFullYear();
    const month = parseInt(req.query.month as string) || (now.getMonth() + 1);
    const entityId = entityIdFromQuery(req);
    const { from, to } = hkMonthBounds(year, month);

    const [recurringItems, pl, arAp] = await Promise.all([
      RecurringItem.find({ active: true, ...(entityId ? { entity: entityId } : {}) }),
      queryPl({ from, to, entityId }),
      liveArAp(entityId),
    ]);

    const prorate = (item: { frequency: string; amount: number }) => {
      if (item.frequency === 'monthly') return item.amount;
      if (item.frequency === 'quarterly') return Math.round(item.amount / 3);
      if (item.frequency === 'yearly') return Math.round(item.amount / 12);
      return 0;
    };

    const monthlyRecurringIncome = recurringItems
      .filter((i) => i.type === 'income')
      .reduce((sum, i) => sum + prorate(i), 0);
    const monthlyRecurringExpense = recurringItems
      .filter((i) => i.type === 'expense')
      .reduce((sum, i) => sum + prorate(i), 0);

    const arCollectible = arAp.accountsReceivable.total;
    const apDue = arAp.accountsPayable.total;
    const gapToBreakeven = Math.max(0, monthlyRecurringExpense + apDue - monthlyRecurringIncome - arCollectible);
    const remainingToBreakeven = Math.max(0, gapToBreakeven - pl.net);

    res.json({
      period: { year, month },
      recurring: {
        monthlyRecurringIncome,
        monthlyRecurringExpense,
        monthlyRecurringNet: monthlyRecurringIncome - monthlyRecurringExpense,
      },
      currentMonthActuals: {
        income: pl.income,
        expense: pl.expense,
        net: pl.net,
      },
      obligations: {
        arCollectible,
        arCount: arAp.accountsReceivable.count,
        apDue,
        apCount: arAp.accountsPayable.count,
      },
      breakeven: {
        gapToBreakeven,
        remainingToBreakeven,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/client-health', async (req, res, next) => {
  try {
    const entityId = entityIdFromQuery(req);
    const now = new Date();
    const invoiceFilter: Record<string, unknown> = { status: { $in: [...AR_OPEN_STATUSES] } };
    if (entityId) invoiceFilter.entity = new mongoose.Types.ObjectId(entityId);

    const [arByClient, recurringByClient] = await Promise.all([
      Invoice.aggregate([
        { $match: invoiceFilter },
        {
          $group: {
            _id: '$client',
            totalOwed: { $sum: '$amountDue' },
            invoiceCount: { $sum: 1 },
            oldestDueDate: { $min: '$dueDate' },
            oldestCreatedAt: { $min: '$createdAt' },
          },
        },
        {
          $lookup: {
            from: 'clients',
            localField: '_id',
            foreignField: '_id',
            as: 'client',
          },
        },
        { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
        { $sort: { totalOwed: -1 } },
      ]),
      RecurringItem.find({ active: true, type: 'income', ...(entityId ? { entity: entityId } : {}) })
        .select('client amount frequency')
        .lean(),
    ]);

    const recurringMap = new Map<string, number>();
    for (const item of recurringByClient) {
      if (!item.client) continue;
      const clientId = String(item.client);
      let monthly = 0;
      if (item.frequency === 'monthly') monthly = item.amount;
      else if (item.frequency === 'quarterly') monthly = Math.round(item.amount / 3);
      else if (item.frequency === 'yearly') monthly = Math.round(item.amount / 12);
      recurringMap.set(clientId, (recurringMap.get(clientId) || 0) + monthly);
    }

    const clients = arByClient.map((row) => {
      const clientId = row._id ? String(row._id) : null;
      const referenceDate = row.oldestDueDate || row.oldestCreatedAt;
      const oldestOverdueDays = referenceDate
        ? Math.max(0, Math.floor((now.getTime() - new Date(referenceDate).getTime()) / 86400000))
        : 0;
      const recurringMonthlyValue = clientId ? (recurringMap.get(clientId) || 0) : 0;

      return {
        clientId,
        clientName: row.client?.name || 'Unknown',
        totalOwed: row.totalOwed,
        invoiceCount: row.invoiceCount,
        oldestOverdueDays,
        hasRecurringIncome: recurringMonthlyValue > 0,
        recurringMonthlyValue,
      };
    });

    res.json({ clients });
  } catch (error) {
    next(error);
  }
});

export default router;
