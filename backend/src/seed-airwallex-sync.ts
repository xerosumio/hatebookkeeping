import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(scriptDir, '../.env') });

import { Transaction } from './models/Transaction.js';
import { Receipt } from './models/Receipt.js';
import { Fund } from './models/Fund.js';
import { getBalances, getFinancialTransactions } from './services/airwallex.js';
import type { AirwallexFinancialTransaction } from './services/airwallex.js';

const CUTOFF = new Date('2026-04-01T00:00:00Z');
const AX_ENTITY = new mongoose.Types.ObjectId('69e4cc4ad80b3c6c435b8add');
const NT_ENTITY = new mongoose.Types.ObjectId('69e4cc4ad80b3c6c435b8ad3');
const CREATED_BY = new mongoose.Types.ObjectId('69e4cc4ad80b3c6c435b8af4');

const ENTITY_MAP: Record<'ax' | 'nt', { entity: mongoose.Types.ObjectId; fundName: string }> = {
  ax: { entity: AX_ENTITY, fundName: 'Axilogy Airwallex' },
  nt: { entity: NT_ENTITY, fundName: 'Naton Airwallex' },
};

function classifySourceType(t: AirwallexFinancialTransaction): 'income' | 'expense' | 'transfer' {
  if (t.amount > 0) return 'income';
  if (t.amount < 0) return 'expense';
  return 'income';
}

function categoryFromSource(t: AirwallexFinancialTransaction): string {
  const st = t.source_type;
  if (st === 'DEPOSIT') return 'Revenue';
  if (st === 'PAYOUT' || st === 'BATCH_PAYOUT') return 'Operating Expense';
  if (st === 'CARD_PURCHASE') return 'Operating Expense';
  if (st === 'FEE') return 'Bank Fees';
  if (st === 'TRANSFER') return 'Inter-company Transfer';
  return 'Other';
}

function descFromAirwallex(t: AirwallexFinancialTransaction): string {
  const parts: string[] = [];
  parts.push(`[${t.source_type}]`);
  if (t.description) parts.push(t.description);
  return parts.join(' ') || `Airwallex ${t.source_type} ${t.id.slice(0, 8)}`;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB\n');

  // ── 1. Fetch live balances ──
  console.log('=== Step 1: Fetch live Airwallex balances ===');
  const axBalances = await getBalances('ax');
  const ntBalances = await getBalances('nt');
  const axLiveHKD = axBalances.find((b) => b.currency === 'HKD')?.total_amount ?? 0;
  const ntLiveHKD = ntBalances.find((b) => b.currency === 'HKD')?.total_amount ?? 0;
  console.log(`  AX live HKD: $${axLiveHKD.toLocaleString()}`);
  console.log(`  NT live HKD: $${ntLiveHKD.toLocaleString()}`);

  // ── 2. Fetch ALL Airwallex transactions ──
  console.log('\n=== Step 2: Fetch all Airwallex transactions ===');
  const axAllTxns = await getFinancialTransactions('ax', { currency: 'HKD' });
  const ntAllTxns = await getFinancialTransactions('nt', { currency: 'HKD' });
  console.log(`  AX: ${axAllTxns.length} total transactions`);
  console.log(`  NT: ${ntAllTxns.length} total transactions`);

  // ── 3. Compute pre-April net to get opening balance ──
  console.log('\n=== Step 3: Compute April 1 opening balances ===');
  function computePreAprilNet(txns: AirwallexFinancialTransaction[]): number {
    return txns
      .filter((t) => new Date(t.settled_at || t.created_at) < CUTOFF)
      .reduce((sum, t) => sum + t.amount, 0);
  }

  const axOpeningBalance = Math.round(computePreAprilNet(axAllTxns) * 100);
  const ntOpeningBalance = Math.round(computePreAprilNet(ntAllTxns) * 100);
  console.log(`  AX opening balance (Apr 1): $${(axOpeningBalance / 100).toFixed(2)}`);
  console.log(`  NT opening balance (Apr 1): $${(ntOpeningBalance / 100).toFixed(2)}`);

  // ── 4. Delete all system transactions before April 1 ──
  console.log('\n=== Step 4: Delete pre-April system transactions ===');
  const preAprilResult = await Transaction.deleteMany({ date: { $lt: CUTOFF } });
  console.log(`  Deleted ${preAprilResult.deletedCount} pre-April transactions`);

  // ── 5. Get April+ Airwallex transactions ──
  const axAprilTxns = axAllTxns.filter(
    (t) => new Date(t.settled_at || t.created_at) >= CUTOFF,
  );
  const ntAprilTxns = ntAllTxns.filter(
    (t) => new Date(t.settled_at || t.created_at) >= CUTOFF,
  );
  console.log(`\n=== Step 5: Match April+ transactions ===`);
  console.log(`  AX April+: ${axAprilTxns.length} bank transactions`);
  console.log(`  NT April+: ${ntAprilTxns.length} bank transactions`);

  // ── 6. Get existing system transactions (April+) ──
  const existingTxns = await Transaction.find({ date: { $gte: CUTOFF } }).lean();
  console.log(`  System April+: ${existingTxns.length} existing transactions`);

  // ── 7. Match and reconcile ──
  async function reconcileEntity(
    code: 'ax' | 'nt',
    bankTxns: AirwallexFinancialTransaction[],
  ) {
    const { entity, fundName } = ENTITY_MAP[code];
    const sysTxns = existingTxns.filter(
      (t) => t.bankAccount === fundName,
    );

    console.log(`\n  --- ${code.toUpperCase()} reconciliation ---`);
    console.log(`    Bank: ${bankTxns.length} txns, System: ${sysTxns.length} txns`);

    const matchedSystemIds = new Set<string>();
    const matchedBankIds = new Set<string>();
    const matches: Array<{ bankTxn: AirwallexFinancialTransaction; sysTxn: typeof sysTxns[0] }> = [];

    for (const bt of bankTxns) {
      const bankAmountCents = Math.round(Math.abs(bt.amount) * 100);
      const bankDate = new Date(bt.settled_at || bt.created_at);
      const bankType = bt.amount > 0 ? 'income' : 'expense';

      let bestMatch = null;
      let bestDateDiff = Infinity;

      for (const st of sysTxns) {
        if (matchedSystemIds.has(st._id.toString())) continue;
        if (st.type !== bankType) continue;
        if (st.amount !== bankAmountCents) continue;

        const diff = Math.abs(bankDate.getTime() - new Date(st.date).getTime());
        const daysDiff = diff / (1000 * 60 * 60 * 24);
        if (daysDiff <= 3 && daysDiff < bestDateDiff) {
          bestDateDiff = daysDiff;
          bestMatch = st;
        }
      }

      if (bestMatch) {
        matches.push({ bankTxn: bt, sysTxn: bestMatch });
        matchedSystemIds.add(bestMatch._id.toString());
        matchedBankIds.add(bt.id);
      }
    }

    console.log(`    Matched: ${matches.length}`);

    for (const m of matches) {
      const bankDate = new Date(m.bankTxn.settled_at || m.bankTxn.created_at);
      await Transaction.updateOne(
        { _id: m.sysTxn._id },
        {
          $set: {
            reconciled: true,
            bankReference: m.bankTxn.id,
            date: bankDate,
          },
        },
      );
    }

    const unmatchedBank = bankTxns.filter((bt) => !matchedBankIds.has(bt.id));
    console.log(`    Unmatched bank txns: ${unmatchedBank.length}`);
    for (const bt of unmatchedBank) {
      const bankDate = new Date(bt.settled_at || bt.created_at);
      const type = classifySourceType(bt);
      if (type === 'transfer') {
        console.log(`      SKIP TRANSFER: ${bt.settled_at?.slice(0, 10)} ${bt.amount} ${bt.source_type} ${bt.id.slice(0, 8)}`);
        continue;
      }
      const amountCents = Math.round(Math.abs(bt.amount) * 100);

      console.log(`      CREATE: ${bankDate.toISOString().slice(0, 10)} | ${type} | $${(amountCents / 100).toFixed(2)} | ${bt.source_type}`);
      await Transaction.create({
        date: bankDate,
        type,
        category: categoryFromSource(bt),
        description: descFromAirwallex(bt),
        amount: amountCents,
        entity,
        bankAccount: fundName,
        bankReference: bt.id,
        reconciled: true,
        createdBy: CREATED_BY,
      });
    }

    const unmatchedSystem = sysTxns.filter(
      (st) => !matchedSystemIds.has(st._id.toString()),
    );
    if (unmatchedSystem.length > 0) {
      console.log(`    Unmatched system txns (NOT in bank):`);
      for (const st of unmatchedSystem) {
        console.log(`      ${new Date(st.date).toISOString().slice(0, 10)} | ${st.type} | $${(st.amount / 100).toFixed(2)} | ${st.description.slice(0, 60)} | refs: inv=${st.invoice || '-'} pr=${st.paymentRequest || '-'}`);
      }
    }
  }

  await reconcileEntity('ax', axAprilTxns);
  await reconcileEntity('nt', ntAprilTxns);

  // ── 8. Recompute fund balances ──
  console.log('\n=== Step 8: Recompute fund balances ===');
  for (const [code, { fundName }] of Object.entries(ENTITY_MAP) as Array<['ax' | 'nt', typeof ENTITY_MAP['ax']]>) {
    const openingCents = code === 'ax' ? axOpeningBalance : ntOpeningBalance;
    const fund = await Fund.findOne({ name: fundName });
    if (!fund) {
      console.log(`  Fund "${fundName}" not found!`);
      continue;
    }

    const results = await Transaction.aggregate([
      { $match: { bankAccount: fundName } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);

    let income = 0;
    let expense = 0;
    for (const r of results) {
      if (r._id === 'income') income = r.total;
      if (r._id === 'expense') expense = r.total;
    }
    const net = income - expense;
    const newBalance = openingCents + net;

    console.log(`  ${fundName}:`);
    console.log(`    Opening: $${(openingCents / 100).toFixed(2)}`);
    console.log(`    Income: $${(income / 100).toFixed(2)}, Expense: $${(expense / 100).toFixed(2)}, Net: $${(net / 100).toFixed(2)}`);
    console.log(`    Old balance: $${(fund.balance / 100).toFixed(2)} → New: $${(newBalance / 100).toFixed(2)}`);

    fund.openingBalance = openingCents;
    fund.balance = newBalance;
    await fund.save();
  }

  // ── 9. Verify against live balance ──
  console.log('\n=== Step 9: Verification ===');
  for (const [code, { fundName }] of Object.entries(ENTITY_MAP) as Array<['ax' | 'nt', typeof ENTITY_MAP['ax']]>) {
    const fund = await Fund.findOne({ name: fundName });
    const liveAmount = code === 'ax' ? axLiveHKD : ntLiveHKD;
    const liveCents = Math.round(liveAmount * 100);
    const systemCents = fund?.balance ?? 0;
    const diff = systemCents - liveCents;
    const ok = Math.abs(diff) < 100;
    console.log(`  ${fundName}:`);
    console.log(`    Live:   $${(liveCents / 100).toFixed(2)}`);
    console.log(`    System: $${(systemCents / 100).toFixed(2)}`);
    console.log(`    Diff:   $${(diff / 100).toFixed(2)} ${ok ? '✓' : '✗ MISMATCH'}`);
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
