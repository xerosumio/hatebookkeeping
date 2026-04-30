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
import { User } from '../models/User.js';
import { Settings } from '../models/Settings.js';
import { getNextSequence } from '../models/Counter.js';
import { authMiddleware, AuthRequest, roleGuard } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getRequiredApproverIds, hasFullApproval } from '../utils/dualApproval.js';
import { sendEmail, buildStatusChangeEmailHtml, buildMonthlyCloseEmailHtml } from '../utils/email.js';
import { env } from '../config/env.js';

const router = Router();
router.use(authMiddleware);

// ── Helpers ──────────────────────────────────────────────────────────

async function computeOpeningCash(year: number, month: number, entityId: string): Promise<number> {
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 1) { prevYear--; prevMonth = 12; }

  const priorClose = await MonthlyClose.findOne({
    entity: entityId,
    year: prevYear,
    month: prevMonth,
    status: 'finalized',
  });

  if (priorClose) {
    return priorClose.closingCash;
  }

  // First month: derive actual bank balance at month start
  // = current bank balance - net of all transactions from this month onwards
  const bankFunds = await Fund.find({
    entity: new mongoose.Types.ObjectId(entityId),
    type: 'bank',
    active: true,
  });
  const currentBankBalance = bankFunds.reduce((sum, f) => sum + (f.balance || 0), 0);

  const startDate = new Date(year, month - 1, 1);
  const txnResults = await Transaction.aggregate([
    { $match: { entity: new mongoose.Types.ObjectId(entityId), date: { $gte: startDate } } },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ]);

  let txnIncome = 0;
  let txnExpense = 0;
  for (const r of txnResults) {
    if (r._id === 'income') txnIncome = r.total;
    if (r._id === 'expense') txnExpense = r.total;
  }

  return currentBankBalance - (txnIncome - txnExpense);
}

async function computeMonthlyFigures(year: number, month: number, entityId: string) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  // P&L by accountingDate, excluding non-operational categories (for reporting)
  const NON_OPERATIONAL_CATEGORIES = ['Currency Conversion', 'Intercompany Transfer'];
  const plResults = await Transaction.aggregate([
    { $addFields: { _effectiveDate: { $ifNull: ['$accountingDate', '$date'] } } },
    { $match: { _effectiveDate: { $gte: startDate, $lt: endDate }, category: { $nin: NON_OPERATIONAL_CATEGORIES }, entity: new mongoose.Types.ObjectId(entityId) } },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ]);

  let totalIncome = 0;
  let totalExpense = 0;
  for (const r of plResults) {
    if (r._id === 'income') totalIncome = r.total;
    if (r._id === 'expense') totalExpense = r.total;
  }

  // Actual cash flow by bank date, all categories (for cash position)
  const cashResults = await Transaction.aggregate([
    { $match: { date: { $gte: startDate, $lt: endDate }, entity: new mongoose.Types.ObjectId(entityId) } },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ]);

  let cashIn = 0;
  let cashOut = 0;
  for (const r of cashResults) {
    if (r._id === 'income') cashIn = r.total;
    if (r._id === 'expense') cashOut = r.total;
  }

  const openingCash = await computeOpeningCash(year, month, entityId);
  const netProfit = totalIncome - totalExpense;
  const cashFlow = cashIn - cashOut;
  const availableCash = openingCash + cashFlow;

  return { openingCash, totalIncome, totalExpense, netProfit, availableCash };
}

function computeDistribution(availableCash: number, shareholders: Array<{ _id: any; sharePercent: number }>) {
  const isLoss = availableCash < 0;
  let shareholderPool = 0;
  let companyReserve = 0;
  let staffReserve = 0;

  if (!isLoss) {
    shareholderPool = Math.round(availableCash * 0.75);
    companyReserve = Math.round(availableCash * 0.20);
    staffReserve = availableCash - shareholderPool - companyReserve;
  } else {
    shareholderPool = availableCash;
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

  const closingCash = isLoss ? 0 : companyReserve;

  return { shareholderPool: Math.abs(shareholderPool), companyReserve, staffReserve, closingCash, isLoss, distributions };
}

function getMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1).toLocaleString('en', { month: 'long', year: 'numeric' });
}

function formatCents(amount: number): string {
  return `HK$ ${(Math.abs(amount) / 100).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function populateClose(query: any) {
  return query
    .populate('distributions.shareholder', 'name sharePercent')
    .populate('closedBy', 'name')
    .populate('approvedBy', 'name')
    .populate('approvals.user', 'name')
    .populate('activityLog.user', 'name')
    .populate('entity', 'code name');
}

// ── List all closes ──────────────────────────────────────────────────

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

// ── Group summary (all entities for a year, or year+month) ───────────

router.get('/summary/:year/:month?', async (req: any, res, next) => {
  try {
    const year = parseInt(req.params.year);
    const monthParam = req.params.month ? parseInt(req.params.month) : undefined;

    const filter: Record<string, unknown> = { year };
    if (monthParam) filter.month = monthParam;

    const closes = await MonthlyClose.find(filter)
      .populate('entity', 'code name')
      .populate('distributions.shareholder', 'name sharePercent');

    if (monthParam) {
      // Single month group summary
      const totalIncome = closes.reduce((s, c) => s + c.totalIncome, 0);
      const totalExpense = closes.reduce((s, c) => s + c.totalExpense, 0);
      const totalOpeningCash = closes.reduce((s, c) => s + (c.openingCash || 0), 0);
      const totalAvailableCash = closes.reduce((s, c) => s + (c.availableCash || 0), 0);
      const totalShareholderDist = closes.reduce((s, c) => s + c.shareholderDistribution, 0);
      const totalCompanyReserve = closes.reduce((s, c) => s + c.companyReserve, 0);
      const totalStaffReserve = closes.reduce((s, c) => s + c.staffReserve, 0);

      // Aggregate distributions by shareholder across entities
      const shareholderMap = new Map<string, { name: string; sharePercent: number; total: number }>();
      for (const c of closes) {
        for (const d of c.distributions) {
          const sh = d.shareholder as any;
          const id = sh?._id?.toString() || d.shareholder?.toString();
          const existing = shareholderMap.get(id);
          if (existing) {
            existing.total += d.amount;
          } else {
            shareholderMap.set(id, {
              name: sh?.name || id,
              sharePercent: d.sharePercent,
              total: d.amount,
            });
          }
        }
      }

      const allFinalized = closes.length > 0 && closes.every((c) => c.status === 'finalized');
      const anyPending = closes.some((c) => c.status === 'pending_approval');

      res.json({
        year,
        month: monthParam,
        openingCash: totalOpeningCash,
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalExpense,
        availableCash: totalAvailableCash,
        shareholderDistribution: totalShareholderDist,
        companyReserve: totalCompanyReserve,
        staffReserve: totalStaffReserve,
        isLoss: totalAvailableCash < 0,
        groupStatus: allFinalized ? 'finalized' : anyPending ? 'pending' : 'open',
        entities: closes.map((c) => ({
          entity: c.entity,
          openingCash: c.openingCash || 0,
          totalIncome: c.totalIncome,
          totalExpense: c.totalExpense,
          netProfit: c.netProfit,
          availableCash: c.availableCash || 0,
          shareholderDistribution: c.shareholderDistribution,
          companyReserve: c.companyReserve,
          staffReserve: c.staffReserve,
          isLoss: c.isLoss,
          status: c.status,
        })),
        distributions: [...shareholderMap.values()].sort((a, b) => b.sharePercent - a.sharePercent),
      });
    } else {
      // Full year overview: group by month
      const byMonth = new Map<number, typeof closes>();
      for (const c of closes) {
        const arr = byMonth.get(c.month) || [];
        arr.push(c);
        byMonth.set(c.month, arr);
      }

      const months = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const monthCloses = byMonth.get(m) || [];
        const totalIncome = monthCloses.reduce((s, c) => s + c.totalIncome, 0);
        const totalExpense = monthCloses.reduce((s, c) => s + c.totalExpense, 0);
        const allFinalized = monthCloses.length > 0 && monthCloses.every((c) => c.status === 'finalized');
        return {
          month: m,
          entityCount: monthCloses.length,
          totalIncome,
          totalExpense,
          netProfit: totalIncome - totalExpense,
          status: monthCloses.length === 0 ? 'open' : allFinalized ? 'finalized' : 'partial',
        };
      });

      res.json({ year, months });
    }
  } catch (error) {
    next(error);
  }
});

// ── Get / preview (draft) ────────────────────────────────────────────

router.get('/:entity/:year/:month', async (req, res, next) => {
  try {
    const entityId = req.params.entity as string;
    const year = parseInt(req.params.year as string);
    const month = parseInt(req.params.month as string);
    const existing = await populateClose(
      MonthlyClose.findOne({ entity: entityId, year, month }),
    );
    if (existing) return res.json(existing);

    const figures = await computeMonthlyFigures(year, month, entityId);
    const shareholders = await Shareholder.find({ active: true }).sort({ sharePercent: -1 });
    const dist = computeDistribution(figures.availableCash, shareholders);

    res.json({
      entity: entityId,
      year,
      month,
      status: 'draft',
      ...figures,
      shareholderDistribution: dist.shareholderPool,
      companyReserve: dist.companyReserve,
      staffReserve: dist.staffReserve,
      closingCash: dist.closingCash,
      isLoss: dist.isLoss,
      distributions: dist.distributions.map((d) => {
        const sh = shareholders.find((s) => s._id.equals(d.shareholder));
        return { ...d, shareholder: { _id: sh!._id, name: sh!.name, sharePercent: sh!.sharePercent } };
      }),
      approvals: [],
      activityLog: [],
      notifiedEmails: [],
    });
  } catch (error) {
    next(error);
  }
});

// ── Recompute preview ────────────────────────────────────────────────

router.post('/:entity/:year/:month/preview', async (req, res, next) => {
  try {
    const entityId = req.params.entity as string;
    const year = parseInt(req.params.year as string);
    const month = parseInt(req.params.month as string);

    const figures = await computeMonthlyFigures(year, month, entityId);
    const shareholders = await Shareholder.find({ active: true }).sort({ sharePercent: -1 });
    const dist = computeDistribution(figures.availableCash, shareholders);

    res.json({
      entity: entityId,
      year,
      month,
      ...figures,
      shareholderDistribution: dist.shareholderPool,
      companyReserve: dist.companyReserve,
      staffReserve: dist.staffReserve,
      closingCash: dist.closingCash,
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

// ── Submit for approval ──────────────────────────────────────────────

router.post('/:entity/:year/:month/submit', roleGuard('admin'), async (req: AuthRequest, res, next) => {
  try {
    const entityId = req.params.entity as string;
    const year = parseInt(req.params.year as string);
    const month = parseInt(req.params.month as string);
    const { notes } = z.object({ notes: z.string().optional().default('') }).parse(req.body);

    const existing = await MonthlyClose.findOne({ entity: entityId, year, month });
    if (existing?.status === 'finalized') throw new AppError(400, 'Month already finalized');
    if (existing?.status === 'pending_approval') throw new AppError(400, 'Already pending approval');

    const figures = await computeMonthlyFigures(year, month, entityId);
    const shareholders = await Shareholder.find({ active: true }).sort({ sharePercent: -1 });
    const dist = computeDistribution(figures.availableCash, shareholders);

    const distEntries = dist.distributions.map((d) => ({
      shareholder: d.shareholder,
      sharePercent: d.sharePercent,
      amount: d.amount,
    }));

    const activityLog = [{ action: 'submitted' as const, user: req.user!._id, timestamp: new Date() }];

    const closeDoc = existing
      ? await MonthlyClose.findByIdAndUpdate(existing._id, {
          ...figures,
          shareholderDistribution: dist.shareholderPool,
          companyReserve: dist.companyReserve,
          staffReserve: dist.staffReserve,
          closingCash: dist.closingCash,
          isLoss: dist.isLoss,
          status: 'pending_approval',
          distributions: distEntries,
          approvals: [],
          approvedBy: undefined,
          approvedAt: undefined,
          rejectionReason: undefined,
          notes,
          $push: { activityLog: activityLog[0] },
        }, { new: true })
      : await MonthlyClose.create({
          entity: entityId,
          year,
          month,
          ...figures,
          shareholderDistribution: dist.shareholderPool,
          companyReserve: dist.companyReserve,
          staffReserve: dist.staffReserve,
          closingCash: dist.closingCash,
          isLoss: dist.isLoss,
          status: 'pending_approval',
          distributions: distEntries,
          notes,
          activityLog,
        });

    const result = await populateClose(MonthlyClose.findById(closeDoc!._id));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ── Approve ──────────────────────────────────────────────────────────

router.patch('/:entity/:year/:month/approve', roleGuard('admin'), async (req: AuthRequest, res, next) => {
  try {
    const entityId = req.params.entity as string;
    const year = parseInt(req.params.year as string);
    const month = parseInt(req.params.month as string);

    const close = await MonthlyClose.findOne({ entity: entityId, year, month });
    if (!close) throw new AppError(404, 'Monthly close not found');
    if (close.status !== 'pending_approval') {
      throw new AppError(400, 'Can only approve pending closes');
    }

    const alreadyApproved = (close.approvals || []).some(
      (a) => a.user.toString() === req.user!._id.toString(),
    );
    if (alreadyApproved) throw new AppError(400, 'You have already approved this close');

    close.approvals.push({ user: req.user!._id, at: new Date() });
    close.activityLog.push({
      action: 'approved',
      user: req.user!._id,
      timestamp: new Date(),
    } as any);

    const requiredIds = await getRequiredApproverIds();
    if (hasFullApproval(close.approvals, requiredIds)) {
      close.status = 'approved';
      close.approvedBy = req.user!._id;
      close.approvedAt = new Date();
    }

    await close.save();

    // Send email when fully approved
    if (close.status === 'approved') {
      const settings = await Settings.findOne();
      const companyName = settings?.companyName || 'HateBookkeeping';
      const detailUrl = `${env.frontendUrl}/#/monthly-close/${entityId}/${year}/${month}`;
      const recipientEmails = [...new Set(close.notifiedEmails || [])];

      if (recipientEmails.length > 0) {
        const html = buildStatusChangeEmailHtml({
          companyName,
          requestNumber: getMonthLabel(year, month),
          requestLabel: 'Monthly Close',
          newStatus: 'approved',
          actorName: req.user!.name,
          detailUrl,
        });
        const primary = recipientEmails[0];
        const cc = recipientEmails.slice(1);
        sendEmail({ to: primary, cc: cc.length > 0 ? cc : undefined, subject: `Re: [Monthly Close] ${getMonthLabel(year, month)}`, html }).catch(() => {});
      }
    }

    const result = await populateClose(MonthlyClose.findById(close._id));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ── Reject ───────────────────────────────────────────────────────────

router.patch('/:entity/:year/:month/reject', roleGuard('admin'), async (req: AuthRequest, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    const entityId = req.params.entity as string;
    const year = parseInt(req.params.year as string);
    const month = parseInt(req.params.month as string);

    const close = await MonthlyClose.findOne({ entity: entityId, year, month });
    if (!close) throw new AppError(404, 'Monthly close not found');
    if (close.status !== 'pending_approval') {
      throw new AppError(400, 'Can only reject pending closes');
    }

    close.status = 'rejected';
    close.approvedBy = req.user!._id;
    close.rejectionReason = reason;
    close.approvals = [];
    close.activityLog.push({
      action: 'rejected',
      user: req.user!._id,
      timestamp: new Date(),
      note: reason,
    } as any);
    await close.save();

    // Send rejection email
    const settings = await Settings.findOne();
    const companyName = settings?.companyName || 'HateBookkeeping';
    const detailUrl = `${env.frontendUrl}/#/monthly-close/${entityId}/${year}/${month}`;
    const recipientEmails = [...new Set(close.notifiedEmails || [])];

    if (recipientEmails.length > 0) {
      const html = buildStatusChangeEmailHtml({
        companyName,
        requestNumber: getMonthLabel(year, month),
        requestLabel: 'Monthly Close',
        newStatus: 'rejected',
        actorName: req.user!.name,
        reason,
        detailUrl,
      });
      const primary = recipientEmails[0];
      const cc = recipientEmails.slice(1);
      sendEmail({ to: primary, cc: cc.length > 0 ? cc : undefined, subject: `Re: [Monthly Close] ${getMonthLabel(year, month)}`, html }).catch(() => {});
    }

    const result = await populateClose(MonthlyClose.findById(close._id));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ── Notify (send for approval email) ─────────────────────────────────

router.post('/:entity/:year/:month/notify', async (req: AuthRequest, res, next) => {
  try {
    const { emails } = z.object({ emails: z.array(z.string().email()) }).parse(req.body);
    const entityId = req.params.entity as string;
    const year = parseInt(req.params.year as string);
    const month = parseInt(req.params.month as string);

    const close = await MonthlyClose.findOne({ entity: entityId, year, month });
    if (!close) throw new AppError(404, 'Monthly close not found');

    // Merge emails
    const existing = new Set(close.notifiedEmails || []);
    emails.forEach((e) => existing.add(e));
    close.notifiedEmails = [...existing];
    close.activityLog.push({
      action: 'notified',
      user: req.user!._id,
      timestamp: new Date(),
      note: `Sent to: ${emails.join(', ')}`,
    } as any);
    await close.save();

    // Send email
    const settings = await Settings.findOne();
    const companyName = settings?.companyName || 'HateBookkeeping';
    const entity = await mongoose.model('Entity').findById(entityId);
    const entityName = entity?.name || 'Unknown';
    const detailUrl = `${env.frontendUrl}/#/monthly-close/${entityId}/${year}/${month}`;
    const monthLabel = getMonthLabel(year, month);

    const shareholders = await Shareholder.find({ active: true }).sort({ sharePercent: -1 });
    const distItems = close.distributions.map((d) => {
      const sh = shareholders.find((s) => s._id.equals(d.shareholder));
      return {
        name: sh?.name || 'Unknown',
        sharePercent: d.sharePercent,
        amount: formatCents(d.amount),
        isNegative: d.amount < 0,
      };
    });

    const html = buildMonthlyCloseEmailHtml({
      companyName,
      entityName,
      monthLabel,
      openingCash: formatCents(close.openingCash),
      totalIncome: formatCents(close.totalIncome),
      totalExpense: formatCents(close.totalExpense),
      netProfit: formatCents(close.netProfit),
      availableCash: formatCents(close.availableCash),
      isLoss: close.isLoss,
      shareholderDistribution: formatCents(close.shareholderDistribution),
      companyReserve: formatCents(close.companyReserve),
      staffReserve: formatCents(close.staffReserve),
      distributions: distItems,
      detailUrl,
    });

    const primary = emails[0];
    const cc = emails.slice(1);
    sendEmail({
      to: primary,
      cc: cc.length > 0 ? cc : undefined,
      subject: `[Monthly Close] ${entityName} - ${monthLabel}`,
      html,
    }).catch(() => {});

    const result = await populateClose(MonthlyClose.findById(close._id));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ── Finalize (requires approved status) ──────────────────────────────

router.post('/:entity/:year/:month/finalize', roleGuard('admin'), async (req: AuthRequest, res, next) => {
  try {
    const entityId = req.params.entity as string;
    const year = parseInt(req.params.year as string);
    const month = parseInt(req.params.month as string);
    const { notes } = z.object({ notes: z.string().optional().default('') }).parse(req.body);

    const existing = await MonthlyClose.findOne({ entity: entityId, year, month });
    if (existing?.status === 'finalized') throw new AppError(400, 'Month already finalized');
    if (!existing || existing.status !== 'approved') {
      throw new AppError(400, 'Monthly close must be approved before finalizing');
    }

    // Recompute figures at finalization time
    const figures = await computeMonthlyFigures(year, month, entityId);
    const shareholders = await Shareholder.find({ active: true }).sort({ sharePercent: -1 });
    const dist = computeDistribution(figures.availableCash, shareholders);

    existing.set({
      ...figures,
      shareholderDistribution: dist.shareholderPool,
      companyReserve: dist.companyReserve,
      staffReserve: dist.staffReserve,
      closingCash: dist.closingCash,
      isLoss: dist.isLoss,
      status: 'finalized',
      closedBy: req.user!._id,
      closedAt: new Date(),
      notes: notes || existing.notes,
    });
    existing.activityLog.push({
      action: 'finalized',
      user: req.user!._id,
      timestamp: new Date(),
    } as any);

    // Create equity transactions for each shareholder
    const distributions = [];
    for (const d of dist.distributions) {
      const lastTxn = await EquityTransaction.findOne({ shareholder: d.shareholder })
        .sort({ date: -1, createdAt: -1 });
      const currentBalance = lastTxn?.balanceAfter ?? 0;

      const eqType = dist.isLoss ? 'collection' : 'distribution';
      const amount = dist.isLoss ? Math.abs(d.amount) : -Math.abs(d.amount);
      const balanceAfter = currentBalance + amount;

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
        monthlyClose: existing._id,
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

    existing.distributions = distributions;
    await existing.save();

    // Auto fund transfers for reserves (profit scenario)
    if (!dist.isLoss && dist.companyReserve > 0) {
      const companyReserveFund = await Fund.findOne({ entity: entityId, type: 'reserve', name: /company reserve/i });
      if (companyReserveFund) {
        await Fund.findByIdAndUpdate(companyReserveFund._id, { $inc: { balance: dist.companyReserve } });
        await FundTransfer.create({
          toFund: companyReserveFund._id,
          amount: dist.companyReserve,
          date: new Date(year, month - 1, 28),
          description: `Company reserve allocation — ${getMonthLabel(year, month)}`,
          reference: `monthly-close:${existing._id}`,
          createdBy: req.user!._id,
        });
      }
    }
    if (!dist.isLoss && dist.staffReserve > 0) {
      const staffReserveFund = await Fund.findOne({ entity: entityId, type: 'reserve', name: /staff reserve/i });
      if (staffReserveFund) {
        await Fund.findByIdAndUpdate(staffReserveFund._id, { $inc: { balance: dist.staffReserve } });
        await FundTransfer.create({
          toFund: staffReserveFund._id,
          amount: dist.staffReserve,
          date: new Date(year, month - 1, 28),
          description: `Staff reserve allocation — ${getMonthLabel(year, month)}`,
          reference: `monthly-close:${existing._id}`,
          createdBy: req.user!._id,
        });
      }
    }

    // Send finalized notification
    const settings = await Settings.findOne();
    const companyName = settings?.companyName || 'HateBookkeeping';
    const detailUrl = `${env.frontendUrl}/#/monthly-close/${entityId}/${year}/${month}`;
    const recipientEmails = [...new Set(existing.notifiedEmails || [])];
    if (recipientEmails.length > 0) {
      const html = buildStatusChangeEmailHtml({
        companyName,
        requestNumber: getMonthLabel(year, month),
        requestLabel: 'Monthly Close',
        newStatus: 'executed',
        actorName: req.user!.name,
        detailUrl,
      });
      const primary = recipientEmails[0];
      const cc = recipientEmails.slice(1);
      sendEmail({ to: primary, cc: cc.length > 0 ? cc : undefined, subject: `Re: [Monthly Close] ${getMonthLabel(year, month)}`, html }).catch(() => {});
    }

    const result = await populateClose(MonthlyClose.findById(existing._id));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ── Create collection requests (loss scenario) ──────────────────────

router.post('/:entity/:year/:month/create-collection-requests', roleGuard('admin'), async (req: AuthRequest, res, next) => {
  try {
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
