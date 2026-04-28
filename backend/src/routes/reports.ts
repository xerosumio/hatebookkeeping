import { Router } from 'express';
import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction.js';
import { Invoice } from '../models/Invoice.js';
import { PaymentRequest } from '../models/PaymentRequest.js';
import { RecurringItem } from '../models/RecurringItem.js';
import { Fund } from '../models/Fund.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const NON_OPERATIONAL_CATEGORIES = ['Currency Conversion', 'Intercompany Transfer'];
const excludeNonOperational = { category: { $nin: NON_OPERATIONAL_CATEGORIES } };

// Monthly cash flow
router.get('/cash-flow', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = req.query.month !== undefined ? parseInt(req.query.month as string) : undefined;
    const entity = req.query.entity as string | undefined;

    const rangeStart = new Date(year, month !== undefined ? month : 0, 1);
    const rangeEnd = new Date(year, month !== undefined ? month + 1 : 12, 0);
    const entityMatch = entity ? { entity: new mongoose.Types.ObjectId(entity) } : {};

    const result = await Transaction.aggregate([
      { $addFields: { _effectiveDate: { $ifNull: ['$accountingDate', '$date'] } } },
      { $match: { _effectiveDate: { $gte: rangeStart, $lte: rangeEnd }, ...excludeNonOperational, ...entityMatch } },
      {
        $group: {
          _id: { type: '$type', month: { $month: '$_effectiveDate' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Reshape into monthly data
    const months: Record<number, { income: number; expense: number }> = {};
    for (let m = 1; m <= 12; m++) {
      months[m] = { income: 0, expense: 0 };
    }

    for (const r of result) {
      const m = r._id.month;
      if (r._id.type === 'income') months[m].income = r.total;
      else months[m].expense = r.total;
    }

    const cashFlow = Object.entries(months).map(([m, data]) => ({
      month: parseInt(m),
      income: data.income,
      expense: data.expense,
      net: data.income - data.expense,
    }));

    // Also get totals
    const totalIncome = cashFlow.reduce((s, m) => s + m.income, 0);
    const totalExpense = cashFlow.reduce((s, m) => s + m.expense, 0);

    res.json({
      year,
      months: cashFlow,
      totals: { income: totalIncome, expense: totalExpense, net: totalIncome - totalExpense },
    });
  } catch (error) {
    next(error);
  }
});

// Accounts receivable
router.get('/accounts-receivable', async (req, res, next) => {
  try {
    const filter: Record<string, unknown> = { status: { $in: ['unpaid', 'partial'] } };

    if (req.query.entity) filter.entity = req.query.entity;

    if (req.query.startDate || req.query.endDate) {
      const dueDateFilter: Record<string, Date> = {};
      if (req.query.startDate) dueDateFilter.$gte = new Date(req.query.startDate as string);
      if (req.query.endDate) dueDateFilter.$lte = new Date(req.query.endDate as string);
      filter.dueDate = dueDateFilter;
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

// Recurring overview
router.get('/recurring-overview', async (_req, res, next) => {
  try {
    const items = await RecurringItem.find({ active: true })
      .populate('client', 'name');

    const monthlyIncome = items
      .filter((i) => i.type === 'income')
      .reduce((sum, i) => {
        if (i.frequency === 'monthly') return sum + i.amount;
        if (i.frequency === 'quarterly') return sum + Math.round(i.amount / 3);
        if (i.frequency === 'yearly') return sum + Math.round(i.amount / 12);
        return sum;
      }, 0);

    const monthlyExpense = items
      .filter((i) => i.type === 'expense')
      .reduce((sum, i) => {
        if (i.frequency === 'monthly') return sum + i.amount;
        if (i.frequency === 'quarterly') return sum + Math.round(i.amount / 3);
        if (i.frequency === 'yearly') return sum + Math.round(i.amount / 12);
        return sum;
      }, 0);

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

// Income statement
router.get('/income-statement', async (req, res, next) => {
  try {
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(new Date().getFullYear(), 0, 1);
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();
    const entity = req.query.entity as string | undefined;

    const result = await Transaction.aggregate([
      { $addFields: { _effectiveDate: { $ifNull: ['$accountingDate', '$date'] } } },
      { $match: { _effectiveDate: { $gte: startDate, $lte: endDate }, ...excludeNonOperational, ...(entity ? { entity: new mongoose.Types.ObjectId(entity) } : {}) } },
      {
        $group: {
          _id: { type: '$type', category: '$category' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.type': 1, total: -1 } },
    ]);

    const income: { category: string; total: number; count: number }[] = [];
    const expenses: { category: string; total: number; count: number }[] = [];

    for (const r of result) {
      const entry = { category: r._id.category, total: r.total, count: r.count };
      if (r._id.type === 'income') income.push(entry);
      else expenses.push(entry);
    }

    const totalIncome = income.reduce((s, i) => s + i.total, 0);
    const totalExpense = expenses.reduce((s, i) => s + i.total, 0);

    res.json({
      period: { startDate, endDate },
      income,
      expenses,
      totals: { income: totalIncome, expense: totalExpense, net: totalIncome - totalExpense },
    });
  } catch (error) {
    next(error);
  }
});

// Income statement drill-down: transactions for a specific type+category
router.get('/income-statement/transactions', async (req, res, next) => {
  try {
    const { type, category } = req.query;
    if (!type || !category) {
      res.status(400).json({ error: 'type and category are required' });
      return;
    }

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(new Date().getFullYear(), 0, 1);
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();
    const entity = req.query.entity as string | undefined;

    const transactions = await Transaction.aggregate([
      { $addFields: { _effectiveDate: { $ifNull: ['$accountingDate', '$date'] } } },
      { $match: {
        type: type as string,
        category: category as string,
        _effectiveDate: { $gte: startDate, $lte: endDate },
        ...(entity ? { entity: new mongoose.Types.ObjectId(entity) } : {}),
      }},
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

// Accounts payable (pending + approved payment requests = committed but unpaid outflows)
router.get('/accounts-payable', async (req, res, next) => {
  try {
    const filter: Record<string, unknown> = { status: { $in: ['pending', 'approved'] } };

    if (req.query.entity) filter.entity = req.query.entity;

    if (req.query.startDate || req.query.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (req.query.startDate) dateFilter.$gte = new Date(req.query.startDate as string);
      if (req.query.endDate) dateFilter.$lte = new Date(req.query.endDate as string);
      filter.createdAt = dateFilter;
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
    for (const req of requests) {
      for (const item of req.items) {
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

// Balance sheet — snapshot of financial position
router.get('/balance-sheet', async (req, res, next) => {
  try {
    const entity = req.query.entity as string | undefined;

    const fundFilter: Record<string, unknown> = { active: true };
    if (entity) fundFilter.entity = new mongoose.Types.ObjectId(entity);
    const funds = await Fund.find(fundFilter).populate('entity', 'code name').sort({ type: 1, name: 1 });

    const cashBreakdown = funds.map((f) => ({ name: f.name, type: f.type, balance: f.balance }));
    const totalCash = funds.reduce((s, f) => s + f.balance, 0);

    const arFilter: Record<string, unknown> = { status: { $in: ['unpaid', 'partial', 'sent'] } };
    if (entity) arFilter.entity = new mongoose.Types.ObjectId(entity);
    const arResult = await Invoice.aggregate([
      { $match: arFilter },
      { $group: { _id: null, total: { $sum: '$amountDue' }, count: { $sum: 1 } } },
    ]);
    const accountsReceivable = arResult[0]?.total || 0;
    const arCount = arResult[0]?.count || 0;

    const apFilter: Record<string, unknown> = { status: { $in: ['pending', 'approved'] } };
    if (entity) apFilter.entity = new mongoose.Types.ObjectId(entity);
    const apResult = await PaymentRequest.aggregate([
      { $match: apFilter },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);
    const accountsPayable = apResult[0]?.total || 0;
    const apCount = apResult[0]?.count || 0;

    const totalAssets = totalCash + accountsReceivable;
    const totalLiabilities = accountsPayable;
    const netPosition = totalAssets - totalLiabilities;

    res.json({
      assets: {
        cash: { total: totalCash, breakdown: cashBreakdown },
        accountsReceivable: { total: accountsReceivable, count: arCount },
        total: totalAssets,
      },
      liabilities: {
        accountsPayable: { total: accountsPayable, count: apCount },
        total: totalLiabilities,
      },
      netPosition,
    });
  } catch (error) {
    next(error);
  }
});

// Monthly summary — opening/closing positions and operations
router.get('/monthly-summary', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);
    const entity = req.query.entity as string | undefined;

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const entityMatch = entity ? { entity: new mongoose.Types.ObjectId(entity) } : {};

    const fundFilter: Record<string, unknown> = { active: true };
    if (entity) fundFilter.entity = new mongoose.Types.ObjectId(entity);
    const funds = await Fund.find(fundFilter);
    const totalOpeningBalance = funds.reduce((s, f) => s + f.openingBalance, 0);

    const preMonthTxns = await Transaction.aggregate([
      { $addFields: { _effectiveDate: { $ifNull: ['$accountingDate', '$date'] } } },
      { $match: { _effectiveDate: { $lt: monthStart }, ...excludeNonOperational, ...entityMatch } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);
    let preIncome = 0, preExpense = 0;
    for (const r of preMonthTxns) {
      if (r._id === 'income') preIncome = r.total;
      else preExpense = r.total;
    }
    const openingCash = totalOpeningBalance + preIncome - preExpense;

    const monthTxns = await Transaction.aggregate([
      { $addFields: { _effectiveDate: { $ifNull: ['$accountingDate', '$date'] } } },
      { $match: { _effectiveDate: { $gte: monthStart, $lte: monthEnd }, ...excludeNonOperational, ...entityMatch } },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    let monthIncome = 0, monthExpense = 0;
    for (const r of monthTxns) {
      if (r._id === 'income') monthIncome = r.total;
      else monthExpense = r.total;
    }
    const closingCash = openingCash + monthIncome - monthExpense;

    const arFilter: Record<string, unknown> = { status: { $in: ['unpaid', 'partial', 'sent'] } };
    if (entity) arFilter.entity = new mongoose.Types.ObjectId(entity);

    const openingArResult = await Invoice.aggregate([
      { $match: { ...arFilter, createdAt: { $lt: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amountDue' } } },
    ]);
    const openingAR = openingArResult[0]?.total || 0;

    const closingArResult = await Invoice.aggregate([
      { $match: { ...arFilter, createdAt: { $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: '$amountDue' } } },
    ]);
    const closingAR = closingArResult[0]?.total || 0;

    const apFilter: Record<string, unknown> = { status: { $in: ['pending', 'approved'] } };
    if (entity) apFilter.entity = new mongoose.Types.ObjectId(entity);

    const openingApResult = await PaymentRequest.aggregate([
      { $match: { ...apFilter, createdAt: { $lt: monthStart } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const openingAP = openingApResult[0]?.total || 0;

    const closingApResult = await PaymentRequest.aggregate([
      { $match: { ...apFilter, createdAt: { $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const closingAP = closingApResult[0]?.total || 0;

    const openingAssets = openingCash + openingAR;
    const closingAssets = closingCash + closingAR;
    const openingNet = openingAssets - openingAP;
    const closingNet = closingAssets - closingAP;

    res.json({
      period: { year, month },
      opening: {
        cash: openingCash,
        accountsReceivable: openingAR,
        totalAssets: openingAssets,
        accountsPayable: openingAP,
        netPosition: openingNet,
      },
      operations: {
        income: monthIncome,
        expense: monthExpense,
        net: monthIncome - monthExpense,
      },
      closing: {
        cash: closingCash,
        accountsReceivable: closingAR,
        totalAssets: closingAssets,
        accountsPayable: closingAP,
        netPosition: closingNet,
      },
      change: {
        cash: closingCash - openingCash,
        accountsReceivable: closingAR - openingAR,
        totalAssets: closingAssets - openingAssets,
        accountsPayable: closingAP - openingAP,
        netPosition: closingNet - openingNet,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
