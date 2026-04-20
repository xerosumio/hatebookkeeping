import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(scriptDir, '../.env') });

import { Transaction } from './models/Transaction.js';
import { Fund } from './models/Fund.js';
import { getBalances, getFinancialTransactions } from './services/airwallex.js';

const CUTOFF = new Date('2026-04-01T00:00:00Z');
const AX_ENTITY = new mongoose.Types.ObjectId('69e4cc4ad80b3c6c435b8add');
const NT_ENTITY = new mongoose.Types.ObjectId('69e4cc4ad80b3c6c435b8ad3');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB\n');

  // ── 1. Remove the duplicate transactions created by the previous sync ──
  // These were created from bank payouts but duplicate the existing expense items
  console.log('=== Step 1: Remove duplicates from first sync run ===');
  const duplicates = await Transaction.find({
    description: { $regex: /^\[PAYOUT\]|\[CARD_PURCHASE\]|\[DEPOSIT\]|\[TRANSFER\]/ },
    reconciled: true,
  });
  console.log(`  Found ${duplicates.length} auto-created transactions to remove`);
  for (const d of duplicates) {
    console.log(`    DEL: ${new Date(d.date).toISOString().slice(0, 10)} | ${d.type} | $${(d.amount / 100).toFixed(2)} | ${d.description.slice(0, 50)}`);
    await Transaction.deleteOne({ _id: d._id });
  }

  // ── 2. Map bank payouts to system expense groups ──
  // Bank payouts are consolidated (one payout = multiple expense items)
  // We match by: same date + sum of system expenses = bank payout amount
  console.log('\n=== Step 2: Reconcile AX expense groups against bank payouts ===');

  const axBankTxns = (await getFinancialTransactions('ax', { currency: 'HKD' }))
    .filter((t) => new Date(t.settled_at || t.created_at) >= CUTOFF);

  const axBankPayouts = axBankTxns.filter((t) => t.amount < 0);
  const axBankDeposits = axBankTxns.filter((t) => t.amount > 0);

  console.log(`  Bank payouts: ${axBankPayouts.length}, deposits: ${axBankDeposits.length}`);

  const axSysExpenses = await Transaction.find({
    bankAccount: 'Axilogy Airwallex',
    type: 'expense',
    date: { $gte: CUTOFF },
  }).sort({ date: 1 });

  console.log(`  System expenses: ${axSysExpenses.length}`);

  // Group system expenses by date
  const expensesByDate = new Map<string, typeof axSysExpenses>();
  for (const e of axSysExpenses) {
    const key = new Date(e.date).toISOString().slice(0, 10);
    if (!expensesByDate.has(key)) expensesByDate.set(key, []);
    expensesByDate.get(key)!.push(e);
  }

  // For each bank payout, find the system expenses on the same date whose sum matches
  for (const bp of axBankPayouts) {
    const bpDate = (bp.settled_at || bp.created_at).slice(0, 10);
    const bpAmountCents = Math.round(Math.abs(bp.amount) * 100);
    const dateExpenses = expensesByDate.get(bpDate) || [];

    // Try to find a subset of unreconciled expenses that sum to the bank payout
    const unreconciled = dateExpenses.filter((e) => !e.reconciled);
    const totalUnreconciled = unreconciled.reduce((s, e) => s + e.amount, 0);

    // Check if a single expense matches
    const singleMatch = unreconciled.find((e) => e.amount === bpAmountCents);
    if (singleMatch) {
      console.log(`  MATCH (single): Bank -$${(bpAmountCents / 100).toFixed(2)} on ${bpDate} → "${singleMatch.description}"`);
      singleMatch.reconciled = true;
      singleMatch.bankReference = bp.id;
      await singleMatch.save();
      continue;
    }

    // Check if ALL unreconciled on that date sum to the bank payout
    if (totalUnreconciled === bpAmountCents) {
      console.log(`  MATCH (group): Bank -$${(bpAmountCents / 100).toFixed(2)} on ${bpDate} → ${unreconciled.length} expenses`);
      for (const e of unreconciled) {
        e.reconciled = true;
        e.bankReference = bp.id;
        await e.save();
        console.log(`    → "${e.description}" $${(e.amount / 100).toFixed(2)}`);
      }
      continue;
    }

    // Try subsets: find a combination that sums to the payout
    let found = false;
    for (let mask = 1; mask < (1 << unreconciled.length); mask++) {
      let sum = 0;
      const subset: typeof unreconciled = [];
      for (let i = 0; i < unreconciled.length; i++) {
        if (mask & (1 << i)) {
          sum += unreconciled[i].amount;
          subset.push(unreconciled[i]);
        }
      }
      if (sum === bpAmountCents) {
        console.log(`  MATCH (subset): Bank -$${(bpAmountCents / 100).toFixed(2)} on ${bpDate} → ${subset.length} expenses`);
        for (const e of subset) {
          e.reconciled = true;
          e.bankReference = bp.id;
          await e.save();
          console.log(`    → "${e.description}" $${(e.amount / 100).toFixed(2)}`);
        }
        found = true;
        break;
      }
    }
    if (!found) {
      console.log(`  NO MATCH: Bank -$${(bpAmountCents / 100).toFixed(2)} on ${bpDate} (${bp.source_type})`);
    }
  }

  // ── 3. Reconcile AX income ──
  console.log('\n=== Step 3: Reconcile AX income ===');
  const axSysIncome = await Transaction.find({
    bankAccount: 'Axilogy Airwallex',
    type: 'income',
    date: { $gte: CUTOFF },
  });
  for (const bd of axBankDeposits) {
    const bdAmountCents = Math.round(bd.amount * 100);
    const bdDate = new Date(bd.settled_at || bd.created_at);

    const match = axSysIncome.find((si) => {
      if (si.reconciled) return false;
      if (si.amount !== bdAmountCents) return false;
      const daysDiff = Math.abs(bdDate.getTime() - new Date(si.date).getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 3;
    });

    if (match) {
      console.log(`  MATCH: +$${(bdAmountCents / 100).toFixed(2)} on ${bdDate.toISOString().slice(0, 10)} → "${match.description.slice(0, 50)}"`);
      match.reconciled = true;
      match.bankReference = bd.id;
      match.date = bdDate;
      await match.save();
    } else {
      console.log(`  NO MATCH: +$${(bdAmountCents / 100).toFixed(2)} on ${bdDate.toISOString().slice(0, 10)} (${bd.source_type})`);
    }
  }

  // ── 4. Reconcile NT ──
  console.log('\n=== Step 4: Reconcile NT ===');
  const ntBankTxns = (await getFinancialTransactions('nt', { currency: 'HKD' }))
    .filter((t) => new Date(t.settled_at || t.created_at) >= CUTOFF);

  const ntSysTxns = await Transaction.find({
    bankAccount: 'Naton Airwallex',
    date: { $gte: CUTOFF },
  });

  for (const bt of ntBankTxns) {
    const btAmountCents = Math.round(Math.abs(bt.amount) * 100);
    const btDate = new Date(bt.settled_at || bt.created_at);
    const btType = bt.amount > 0 ? 'income' : 'expense';

    const match = ntSysTxns.find((st) => {
      if (st.reconciled) return false;
      if (st.type !== btType) return false;
      if (st.amount !== btAmountCents) return false;
      return true;
    });

    if (match) {
      console.log(`  MATCH: ${btType} $${(btAmountCents / 100).toFixed(2)} → "${match.description.slice(0, 50)}"`);
      match.reconciled = true;
      match.bankReference = bt.id;
      match.date = btDate;
      await match.save();
    } else {
      // Create if missing
      if (bt.source_type === 'TRANSFER' && bt.amount < 0) {
        console.log(`  CREATE (inter-co transfer out): -$${(btAmountCents / 100).toFixed(2)} on ${btDate.toISOString().slice(0, 10)}`);
        await Transaction.create({
          date: btDate,
          type: 'expense',
          category: 'Inter-company Transfer',
          description: 'Transfer to Axilogy Airwallex',
          amount: btAmountCents,
          entity: NT_ENTITY,
          bankAccount: 'Naton Airwallex',
          bankReference: bt.id,
          reconciled: true,
          createdBy: new mongoose.Types.ObjectId('69e4cc4ad80b3c6c435b8af4'),
        });
      } else if (bt.source_type === 'CARD_PURCHASE') {
        console.log(`  CREATE (card purchase): -$${(btAmountCents / 100).toFixed(2)} on ${btDate.toISOString().slice(0, 10)}`);
        await Transaction.create({
          date: btDate,
          type: 'expense',
          category: 'Operating Expense',
          description: `[Card] Naton card purchase`,
          amount: btAmountCents,
          entity: NT_ENTITY,
          bankAccount: 'Naton Airwallex',
          bankReference: bt.id,
          reconciled: true,
          createdBy: new mongoose.Types.ObjectId('69e4cc4ad80b3c6c435b8af4'),
        });
      } else if (bt.source_type === 'DEPOSIT' && bt.amount > 0) {
        console.log(`  CREATE (deposit): +$${(btAmountCents / 100).toFixed(2)} on ${btDate.toISOString().slice(0, 10)}`);
        await Transaction.create({
          date: btDate,
          type: 'income',
          category: 'Revenue',
          description: `[Deposit] Naton deposit`,
          amount: btAmountCents,
          entity: NT_ENTITY,
          bankAccount: 'Naton Airwallex',
          bankReference: bt.id,
          reconciled: true,
          createdBy: new mongoose.Types.ObjectId('69e4cc4ad80b3c6c435b8af4'),
        });
      } else {
        console.log(`  SKIP: ${btType} $${(btAmountCents / 100).toFixed(2)} ${bt.source_type} on ${btDate.toISOString().slice(0, 10)}`);
      }
    }
  }

  // ── 5. Recompute fund balances ──
  console.log('\n=== Step 5: Recompute fund balances ===');

  const axAllTxns = await getFinancialTransactions('ax', { currency: 'HKD' });
  const ntAllTxns = await getFinancialTransactions('nt', { currency: 'HKD' });
  const axOpeningCents = Math.round(
    axAllTxns
      .filter((t) => new Date(t.settled_at || t.created_at) < CUTOFF)
      .reduce((s, t) => s + t.amount, 0) * 100,
  );
  const ntOpeningCents = Math.round(
    ntAllTxns
      .filter((t) => new Date(t.settled_at || t.created_at) < CUTOFF)
      .reduce((s, t) => s + t.amount, 0) * 100,
  );

  for (const { fundName, openingCents } of [
    { fundName: 'Axilogy Airwallex', openingCents: axOpeningCents },
    { fundName: 'Naton Airwallex', openingCents: ntOpeningCents },
  ]) {
    const fund = await Fund.findOne({ name: fundName });
    if (!fund) continue;

    const results = await Transaction.aggregate([
      { $match: { bankAccount: fundName } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);

    let income = 0, expense = 0;
    for (const r of results) {
      if (r._id === 'income') income = r.total;
      if (r._id === 'expense') expense = r.total;
    }

    const net = income - expense;
    const newBalance = openingCents + net;

    console.log(`  ${fundName}:`);
    console.log(`    Opening: $${(openingCents / 100).toFixed(2)}`);
    console.log(`    Income: $${(income / 100).toFixed(2)}, Expense: $${(expense / 100).toFixed(2)}`);
    console.log(`    Balance: $${(newBalance / 100).toFixed(2)}`);

    fund.openingBalance = openingCents;
    fund.balance = newBalance;
    await fund.save();
  }

  // ── 6. Verify ──
  console.log('\n=== Step 6: Verify against live balances ===');
  const axLive = (await getBalances('ax')).find((b) => b.currency === 'HKD')?.total_amount ?? 0;
  const ntLive = (await getBalances('nt')).find((b) => b.currency === 'HKD')?.total_amount ?? 0;

  for (const { fundName, live } of [
    { fundName: 'Axilogy Airwallex', live: axLive },
    { fundName: 'Naton Airwallex', live: ntLive },
  ]) {
    const fund = await Fund.findOne({ name: fundName });
    const liveCents = Math.round(live * 100);
    const sysCents = fund?.balance ?? 0;
    const diff = sysCents - liveCents;
    const ok = Math.abs(diff) < 100;
    console.log(`  ${fundName}: system=$${(sysCents / 100).toFixed(2)} live=$${(liveCents / 100).toFixed(2)} diff=$${(diff / 100).toFixed(2)} ${ok ? '✓' : '✗'}`);
  }

  // ── 7. Summary of remaining unreconciled ──
  console.log('\n=== Remaining unreconciled transactions ===');
  const unreconciled = await Transaction.find({ reconciled: false, date: { $gte: CUTOFF } }).sort({ date: 1 });
  for (const t of unreconciled) {
    console.log(`  ${new Date(t.date).toISOString().slice(0, 10)} | ${t.bankAccount} | ${t.type} | $${(t.amount / 100).toFixed(2)} | ${t.description.slice(0, 60)}`);
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
