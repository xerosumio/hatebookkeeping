import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  resolveEntity,
  getBalances,
  getFinancialTransactions,
  getGlobalAccounts,
  getGlobalAccountTransactions,
  getTokenStatus,
} from '../services/airwallex.js';
import { runSync } from '../services/airwallexSync.js';
import { AirwallexSyncLog } from '../models/AirwallexSyncLog.js';
import { Fund } from '../models/Fund.js';
import { PendingBankTransaction } from '../models/PendingBankTransaction.js';
import { Transaction } from '../models/Transaction.js';
import { adjustFundBalance } from '../utils/fundBalance.js';

const router = Router();
router.use(authMiddleware);

router.get('/balance/:entity', async (req, res, next) => {
  try {
    const key = resolveEntity(req.params.entity);
    const balances = await getBalances(key);
    const hkd = balances.find((b) => b.currency === 'HKD');
    res.json({
      currency: 'HKD',
      total_amount: hkd?.total_amount ?? 0,
      available_amount: hkd?.available_amount ?? 0,
      pending_amount: hkd?.pending_amount ?? 0,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/transactions/:entity', async (req, res, next) => {
  try {
    const key = resolveEntity(req.params.entity);
    const { from, to, currency } = req.query;
    const txns = await getFinancialTransactions(key, {
      from: from as string,
      to: to as string,
      currency: (currency as string) || 'HKD',
    });
    res.json(txns);
  } catch (error) {
    next(error);
  }
});

router.get('/global-accounts/:entity', async (req, res, next) => {
  try {
    const key = resolveEntity(req.params.entity);
    const accounts = await getGlobalAccounts(key);
    res.json(accounts);
  } catch (error) {
    next(error);
  }
});

router.get('/global-accounts/:entity/:accountId/transactions', async (req, res, next) => {
  try {
    const key = resolveEntity(req.params.entity);
    const { from, to } = req.query;
    const txns = await getGlobalAccountTransactions(key, req.params.accountId, {
      from: from as string,
      to: to as string,
    });
    res.json(txns);
  } catch (error) {
    next(error);
  }
});

router.get('/status', async (_req, res, next) => {
  try {
    const tokens = getTokenStatus();

    const [latestAx, latestNt] = await Promise.all([
      AirwallexSyncLog.findOne({ entity: 'ax' }).sort({ startedAt: -1 }),
      AirwallexSyncLog.findOne({ entity: 'nt' }).sort({ startedAt: -1 }),
    ]);

    const [fundAx, fundNt] = await Promise.all([
      Fund.findOne({ name: 'Axilogy Airwallex' }).select('balance'),
      Fund.findOne({ name: 'Naton Airwallex' }).select('balance'),
    ]);

    let liveAx = null;
    let liveNt = null;
    try {
      const axBal = await getBalances('ax');
      const hkd = axBal.find((b) => b.currency === 'HKD');
      if (hkd) liveAx = Math.round(hkd.total_amount * 100);
    } catch {}
    try {
      const ntBal = await getBalances('nt');
      const hkd = ntBal.find((b) => b.currency === 'HKD');
      if (hkd) liveNt = Math.round(hkd.total_amount * 100);
    } catch {}

    res.json({
      ax: {
        token: tokens.ax,
        lastSync: latestAx,
        systemBalance: fundAx?.balance ?? 0,
        bankBalance: liveAx,
      },
      nt: {
        token: tokens.nt,
        lastSync: latestNt,
        systemBalance: fundNt?.balance ?? 0,
        bankBalance: liveNt,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/sync/:entity', async (req, res, next) => {
  try {
    const key = resolveEntity(req.params.entity);
    const log = await runSync(key);
    res.json(log);
  } catch (error) {
    next(error);
  }
});

router.get('/sync-logs', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const logs = await AirwallexSyncLog.find()
      .sort({ startedAt: -1 })
      .limit(limit);
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

const FUND_NAME: Record<string, string> = {
  ax: 'Axilogy Airwallex',
  nt: 'Naton Airwallex',
};

router.get('/pending', async (req, res, next) => {
  try {
    const { entity } = req.query;
    const filter: Record<string, unknown> = { status: 'pending' };
    if (entity) filter.entity = entity;
    const items = await PendingBankTransaction.find(filter).sort({ date: -1 });
    res.json(items);
  } catch (error) {
    next(error);
  }
});

router.get('/pending/count', async (_req, res, next) => {
  try {
    const count = await PendingBankTransaction.countDocuments({ status: 'pending' });
    res.json({ count });
  } catch (error) {
    next(error);
  }
});

router.post('/pending/:id/match', async (req: AuthRequest, res, next) => {
  try {
    const pending = await PendingBankTransaction.findById(req.params.id);
    if (!pending) throw new AppError(404, 'Pending item not found');
    if (pending.status !== 'pending') throw new AppError(400, 'Item already resolved');

    const { transactionId } = req.body;
    if (!transactionId) throw new AppError(400, 'transactionId is required');

    const txn = await Transaction.findById(transactionId);
    if (!txn) throw new AppError(404, 'Transaction not found');

    txn.reconciled = true;
    if (pending.batchId) txn.bankReference = pending.batchId;
    await txn.save();

    pending.status = 'matched';
    pending.matchedTransaction = txn._id;
    pending.resolvedAt = new Date();
    pending.resolvedBy = req.user?._id;
    await pending.save();

    res.json(pending);
  } catch (error) {
    next(error);
  }
});

router.post('/pending/:id/create', async (req: AuthRequest, res, next) => {
  try {
    const pending = await PendingBankTransaction.findById(req.params.id);
    if (!pending) throw new AppError(404, 'Pending item not found');
    if (pending.status !== 'pending') throw new AppError(400, 'Item already resolved');

    const { category, description, entity: entityId } = req.body;
    if (!category || !description) throw new AppError(400, 'category and description are required');

    const bankAccount = FUND_NAME[pending.entity] || '';

    const txn = await Transaction.create({
      date: pending.date,
      type: pending.type,
      category,
      description,
      amount: pending.amount,
      entity: entityId || undefined,
      bankAccount,
      bankReference: pending.batchId || '',
      reconciled: true,
      createdBy: req.user!._id,
    });

    const balanceAdjust = pending.type === 'income' ? pending.amount : -pending.amount;
    await adjustFundBalance(bankAccount, balanceAdjust);

    pending.status = 'matched';
    pending.matchedTransaction = txn._id;
    pending.resolvedAt = new Date();
    pending.resolvedBy = req.user?._id;
    await pending.save();

    res.json({ pending, transaction: txn });
  } catch (error) {
    next(error);
  }
});

router.post('/pending/:id/dismiss', async (req: AuthRequest, res, next) => {
  try {
    const pending = await PendingBankTransaction.findById(req.params.id);
    if (!pending) throw new AppError(404, 'Pending item not found');
    if (pending.status !== 'pending') throw new AppError(400, 'Item already resolved');

    pending.status = 'dismissed';
    pending.note = req.body.note || '';
    pending.resolvedAt = new Date();
    pending.resolvedBy = req.user?._id;
    await pending.save();

    res.json(pending);
  } catch (error) {
    next(error);
  }
});

export default router;
