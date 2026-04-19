import { Router } from 'express';
import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction.js';
import { Invoice } from '../models/Invoice.js';
import { PaymentRequest } from '../models/PaymentRequest.js';
import { RecurringItem } from '../models/RecurringItem.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// Monthly cash flow
router.get('/cash-flow', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = req.query.month !== undefined ? parseInt(req.query.month as string) : undefined;
    const entity = req.query.entity as string | undefined;

    const matchStage: Record<string, unknown> = {
      date: {
        $gte: new Date(year, month !== undefined ? month : 0, 1),
        $lte: new Date(year, month !== undefined ? month + 1 : 12, 0),
      },
    };
    if (entity) matchStage.entity = new mongoose.Types.ObjectId(entity);

    const result = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { type: '$type', month: { $month: '$date' } },
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
      { $match: { date: { $gte: startDate, $lte: endDate }, ...(entity ? { entity: new mongoose.Types.ObjectId(entity) } : {}) } },
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

    const transactions = await Transaction.find({
      type: type as string,
      category: category as string,
      date: { $gte: startDate, $lte: endDate },
      ...(entity ? { entity } : {}),
    })
      .populate('invoice', 'invoiceNumber')
      .populate('paymentRequest', 'requestNumber')
      .sort({ date: -1 });

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

export default router;
