import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(scriptDir, '../.env') });

import { Transaction } from './models/Transaction.js';
import { Receipt } from './models/Receipt.js';
import { Invoice } from './models/Invoice.js';
import { Fund } from './models/Fund.js';
import { getBalances, getFinancialTransactions } from './services/airwallex.js';

const AX_ENTITY = new mongoose.Types.ObjectId('69e4cc4ad80b3c6c435b8add');
const CREATED_BY = new mongoose.Types.ObjectId('69e4cc4ad80b3c6c435b8af4');

const AX_OPENING_CENTS = 2341565;

const MARCH_CUTOFF = new Date('2026-03-02T00:00:00Z');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB\n');

  // ── 1. Get AX March deposits from Airwallex ──
  console.log('=== Step 1: Fetch AX March bank deposits ===');
  const axAll = await getFinancialTransactions('ax', { currency: 'HKD' });
  const marchDeposits = axAll.filter((t) => {
    const d = new Date(t.settled_at || t.created_at);
    return d >= MARCH_CUTOFF && d < new Date('2026-04-01') && t.amount > 0;
  });
  console.log(`  Found ${marchDeposits.length} March deposits:`);
  for (const d of marchDeposits) {
    console.log(`    ${(d.settled_at || d.created_at).slice(0, 10)} | +$${d.amount.toFixed(2)} | ${d.source_type}`);
  }

  // ── 2. Get receipts that need transaction backfill ──
  console.log('\n=== Step 2: Find March receipts missing transactions ===');
  const marchReceipts = await Receipt.find({ paymentDate: { $lt: new Date('2026-04-01') } }).lean();

  const receiptMap: Array<{
    receipt: typeof marchReceipts[0];
    invoice: any;
    bankTxn: typeof marchDeposits[0] | null;
  }> = [];

  for (const r of marchReceipts) {
    const existingTxn = await Transaction.findOne({ receipt: r._id });
    if (existingTxn) {
      console.log(`  ${(r as any).receiptNumber}: already has txn, skip`);
      continue;
    }
    const inv = await Invoice.findById((r as any).invoice);
    receiptMap.push({ receipt: r, invoice: inv, bankTxn: null });
  }

  console.log(`  ${receiptMap.length} receipts need transaction backfill`);

  // ── 3. Match receipts to Airwallex deposits ──
  console.log('\n=== Step 3: Match receipts to bank deposits ===');
  const usedBankIds = new Set<string>();

  for (const entry of receiptMap) {
    const rAmountCents = (entry.receipt as any).amount;
    const rAmountDollars = rAmountCents / 100;

    // Try exact match first
    let match = marchDeposits.find(
      (d) => !usedBankIds.has(d.id) && Math.abs(d.amount - rAmountDollars) < 0.01,
    );

    if (!match && rAmountCents === 540000) {
      // AX-REC-000007 ($5,400) = sum of three 1,800 deposits
      // Link to first 1,800 deposit as representative
      match = marchDeposits.find(
        (d) => !usedBankIds.has(d.id) && Math.abs(d.amount - 1800) < 0.01,
      );
      if (match) {
        // Mark all three 1,800s as used
        const all1800s = marchDeposits.filter((d) => Math.abs(d.amount - 1800) < 0.01);
        for (const m of all1800s) usedBankIds.add(m.id);
      }
    }

    if (match) {
      usedBankIds.add(match.id);
      entry.bankTxn = match;
      console.log(`  ${(entry.receipt as any).receiptNumber} ($${rAmountDollars.toFixed(2)}) → bank deposit ${match.id.slice(0, 8)} on ${(match.settled_at || match.created_at).slice(0, 10)}`);
    } else {
      console.log(`  ${(entry.receipt as any).receiptNumber} ($${rAmountDollars.toFixed(2)}) → NO bank match`);
    }
  }

  // ── 4. Create transactions for matched receipts ──
  console.log('\n=== Step 4: Create March income transactions ===');
  for (const entry of receiptMap) {
    const r = entry.receipt as any;
    const inv = entry.invoice;
    const bankDate = entry.bankTxn
      ? new Date(entry.bankTxn.settled_at || entry.bankTxn.created_at)
      : new Date(r.paymentDate);

    const txn = await Transaction.create({
      date: bankDate,
      type: 'income',
      category: 'Revenue',
      description: `Payment received — ${inv?.invoiceNumber || 'unknown'}`,
      amount: r.amount,
      entity: AX_ENTITY,
      invoice: r.invoice,
      receipt: r._id,
      bankAccount: 'Axilogy Airwallex',
      bankReference: entry.bankTxn?.id || '',
      reconciled: !!entry.bankTxn,
      createdBy: CREATED_BY,
    });
    console.log(`  Created: ${bankDate.toISOString().slice(0, 10)} | $${(r.amount / 100).toFixed(2)} | ${inv?.invoiceNumber} | reconciled=${!!entry.bankTxn}`);
  }

  // ── 5. Set opening balance to $23,415.65 and recompute ──
  console.log('\n=== Step 5: Set AX opening balance and recompute ===');
  const fund = await Fund.findOne({ name: 'Axilogy Airwallex' });
  if (!fund) throw new Error('Fund not found');

  const results = await Transaction.aggregate([
    { $match: { bankAccount: 'Axilogy Airwallex' } },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ]);

  let income = 0, expense = 0;
  for (const r of results) {
    if (r._id === 'income') income = r.total;
    if (r._id === 'expense') expense = r.total;
  }

  const net = income - expense;
  const newBalance = AX_OPENING_CENTS + net;

  console.log(`  Opening: $${(AX_OPENING_CENTS / 100).toFixed(2)}`);
  console.log(`  Income: $${(income / 100).toFixed(2)}`);
  console.log(`  Expense: $${(expense / 100).toFixed(2)}`);
  console.log(`  Net: $${(net / 100).toFixed(2)}`);
  console.log(`  Old balance: $${(fund.balance / 100).toFixed(2)} → New: $${(newBalance / 100).toFixed(2)}`);

  fund.openingBalance = AX_OPENING_CENTS;
  fund.balance = newBalance;
  await fund.save();

  // ── 6. Verify against live ──
  console.log('\n=== Step 6: Verify ===');
  const axLive = (await getBalances('ax')).find((b) => b.currency === 'HKD')?.total_amount ?? 0;
  const liveCents = Math.round(axLive * 100);
  const diff = newBalance - liveCents;
  console.log(`  System: $${(newBalance / 100).toFixed(2)}`);
  console.log(`  Live:   $${(liveCents / 100).toFixed(2)}`);
  console.log(`  Diff:   $${(diff / 100).toFixed(2)} ${Math.abs(diff) < 100 ? '✓' : ''}`);

  if (Math.abs(diff) > 0) {
    const unreconciled = await Transaction.find({
      bankAccount: 'Axilogy Airwallex',
      reconciled: false,
    });
    const unreconNet = unreconciled.reduce(
      (s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0,
    );
    console.log(`  Unreconciled txns: ${unreconciled.length} (net $${(unreconNet / 100).toFixed(2)})`);
    if (Math.abs(diff - unreconNet) < 100) {
      console.log('  ✓ Difference fully explained by unreconciled transactions');
    }
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
