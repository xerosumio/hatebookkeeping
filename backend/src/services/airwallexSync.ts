import { AirwallexSyncLog } from '../models/AirwallexSyncLog.js';
import { Transaction } from '../models/Transaction.js';
import { Fund } from '../models/Fund.js';
import { PendingBankTransaction } from '../models/PendingBankTransaction.js';
import {
  type EntityKey,
  getFinancialTransactions,
  getBalances,
} from './airwallex.js';
import { FUND_NAME } from '../config/bankAccounts.js';

const CUTOFF: Record<EntityKey, string> = {
  ax: '2026-03-02T00:00:00Z',
  nt: '2026-04-01T00:00:00Z',
};

const DAY_MS = 86_400_000;

export async function runSync(entity: EntityKey) {
  const log = await AirwallexSyncLog.create({
    entity,
    status: 'running',
    startedAt: new Date(),
    matched: 0,
    created: 0,
    unmatched: 0,
    unmatchedItems: [],
  });

  try {
    const lastSuccess = await AirwallexSyncLog.findOne({
      entity,
      status: 'success',
    }).sort({ completedAt: -1 });

    const fromDate = lastSuccess?.completedAt
      ? new Date(lastSuccess.completedAt.getTime() - DAY_MS).toISOString()
      : CUTOFF[entity];

    const bankTxns = await getFinancialTransactions(entity, {
      from: fromDate,
      currency: 'HKD',
      status: 'SETTLED',
    });

    let matched = 0;
    let unmatched = 0;
    const unmatchedItems: Array<{ airwallexId: string; amount: number; date: string; description: string }> = [];

    for (const bt of bankTxns) {
      const amountCents = Math.round(Math.abs(bt.amount) * 100);
      const isDebit = bt.amount < 0;
      const type = isDebit ? 'expense' : 'income';

      const existing = await Transaction.findOne({
        bankAccount: FUND_NAME[entity],
        type,
        amount: amountCents,
        reconciled: true,
        date: {
          $gte: new Date(new Date(bt.created_at).getTime() - 3 * DAY_MS),
          $lte: new Date(new Date(bt.created_at).getTime() + 3 * DAY_MS),
        },
      });
      if (existing) {
        matched++;
        continue;
      }

      const unreconciledMatch = await Transaction.findOne({
        bankAccount: FUND_NAME[entity],
        type,
        amount: amountCents,
        reconciled: false,
        date: {
          $gte: new Date(new Date(bt.created_at).getTime() - 7 * DAY_MS),
          $lte: new Date(new Date(bt.created_at).getTime() + 7 * DAY_MS),
        },
      });

      if (unreconciledMatch) {
        unreconciledMatch.reconciled = true;
        if (bt.batch_id) unreconciledMatch.bankReference = bt.batch_id;
        await unreconciledMatch.save();
        matched++;

        await PendingBankTransaction.updateOne(
          { airwallexId: bt.id, status: 'pending' },
          { $set: { status: 'matched', matchedTransaction: unreconciledMatch._id, resolvedAt: new Date() } },
        );
      } else {
        unmatched++;
        unmatchedItems.push({
          airwallexId: bt.id,
          amount: bt.amount,
          date: bt.created_at,
          description: `${bt.transaction_type} | ${bt.source_type}`,
        });

        await PendingBankTransaction.updateOne(
          { airwallexId: bt.id },
          {
            $setOnInsert: {
              entity,
              type,
              amount: amountCents,
              rawAmount: bt.amount,
              date: new Date(bt.created_at),
              description: `${bt.transaction_type} | ${bt.source_type}`,
              sourceType: bt.source_type,
              transactionType: bt.transaction_type,
              batchId: bt.batch_id || '',
              status: 'pending',
            },
          },
          { upsert: true },
        );
      }
    }

    const balances = await getBalances(entity);
    const hkd = balances.find((b) => b.currency === 'HKD');
    const bankBalanceCents = hkd ? Math.round(hkd.total_amount * 100) : 0;

    const fund = await Fund.findOne({ name: FUND_NAME[entity] });
    const systemBalance = fund?.balance ?? 0;
    const discrepancy = bankBalanceCents - systemBalance;

    log.status = 'success';
    log.completedAt = new Date();
    log.bankBalance = bankBalanceCents;
    log.systemBalance = systemBalance;
    log.discrepancy = discrepancy;
    log.matched = matched;
    log.unmatched = unmatched;
    log.unmatchedItems = unmatchedItems;
    await log.save();

    console.log(
      `[airwallex-sync] ${entity.toUpperCase()} complete: ${matched} matched, ${unmatched} unmatched, discrepancy ${discrepancy / 100}`,
    );

    return log;
  } catch (err: any) {
    log.status = 'error';
    log.completedAt = new Date();
    log.error = err.message || String(err);
    await log.save();
    console.error(`[airwallex-sync] ${entity.toUpperCase()} failed:`, err.message);
    return log;
  }
}

export async function runSyncAll() {
  console.log('[airwallex-sync] Starting sync for all entities...');
  await runSync('ax');
  await runSync('nt');
  console.log('[airwallex-sync] All entity sync complete');
}
