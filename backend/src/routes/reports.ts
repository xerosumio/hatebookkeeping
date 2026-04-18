import { Router } from 'express';
import { Transaction } from '../models/Transaction.js';
import { Invoice } from '../models/Invoice.js';
import { RecurringItem } from '../models/RecurringItem.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// Monthly cash flow
router.get('/cash-flow', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = req.query.month !== undefined ? parseInt(req.query.month as string) : undefined;

    const matchStage: Record<string, unknown> = {
      date: {
        $gte: new Date(year, month !== undefined ? month : 0, 1),
        $lte: new Date(year, month !== undefined ? month + 1 : 12, 0),
      },
    };

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
router.get('/accounts-receivable', async (_req, res, next) => {
  try {
    const invoices = await Invoice.find({ status: { $in: ['unpaid', 'partial'] } })
      .populate('client', 'name')
      .sort({ createdAt: -1 });

    const totalDue = invoices.reduce((sum, inv) => sum + inv.amountDue, 0);
    const overdue = invoices.filter((inv) => inv.dueDate && new Date(inv.dueDate) < new Date());

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

    const result = await Transaction.aggregate([
      { $match: { date: { $gte: startDate, $lte: endDate } } },
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

export default router;
