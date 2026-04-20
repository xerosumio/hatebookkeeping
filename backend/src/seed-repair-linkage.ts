import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(scriptDir, '../.env') });

import { Transaction } from './models/Transaction.js';
import { Receipt } from './models/Receipt.js';
import { Fund } from './models/Fund.js';

const AXILOGY_ENTITY = new mongoose.Types.ObjectId('69e4cc4ad80b3c6c435b8add');
const CREATED_BY = new mongoose.Types.ObjectId('69e4cc4ad80b3c6c435b8af4');
const ANDY_PAYEE = new mongoose.Types.ObjectId('69e52a6d134a9302f89e5c65');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  // ── 1. Re-create missing Beigehill income transaction ──
  console.log('\n=== Beigehill income +$38,700 (Feb 16) ===');
  const existingBeigehill = await Transaction.findOne({
    type: 'income',
    amount: 3870000,
    bankAccount: 'Axilogy Airwallex',
  });
  if (existingBeigehill) {
    console.log('  Already exists, skipping');
  } else {
    await Transaction.create({
      date: new Date('2026-02-16'),
      type: 'income',
      category: 'Revenue',
      description: 'Beigehill — INV-1088-202602-0018, INV-1085-202602-0015',
      amount: 3870000,
      entity: AXILOGY_ENTITY,
      bankAccount: 'Axilogy Airwallex',
      bankReference: 'Axilogy Limited, 7950133712',
      createdBy: CREATED_BY,
    });
    console.log('  Created');
  }

  // ── 2. Re-create missing Andy Feb salary expense ──
  console.log('\n=== Andy Feb salary -$25,200 (Mar 5) ===');
  const existingAndy = await Transaction.findOne({
    type: 'expense',
    amount: 2520000,
    bankAccount: 'Axilogy Airwallex',
    description: { $regex: /Feb 2026/i },
  });
  if (existingAndy) {
    console.log('  Already exists, skipping');
  } else {
    await Transaction.create({
      date: new Date('2026-03-05'),
      type: 'expense',
      category: 'Salary',
      description: 'Feb 2026 Salary — Andy (Wong Tin Chi)',
      amount: 2520000,
      entity: AXILOGY_ENTITY,
      payee: ANDY_PAYEE,
      bankAccount: 'Axilogy Airwallex',
      bankReference: 'P260305-4M0FOEL',
      createdBy: CREATED_BY,
    });
    console.log('  Created');
  }

  // ── 3. Backfill transaction for AX-REC-000007 ──
  console.log('\n=== Backfill AX-REC-000007 ($5,400) ===');
  const rec7 = await Receipt.findOne({ receiptNumber: 'AX-REC-000007' });
  if (!rec7) {
    console.log('  Receipt not found, skipping');
  } else {
    const existingTxn7 = await Transaction.findOne({ receipt: rec7._id });
    if (existingTxn7) {
      console.log('  Transaction already exists, skipping');
    } else {
      await Transaction.create({
        date: rec7.paymentDate,
        type: 'income',
        category: 'Revenue',
        description: `Payment received — AX-INV-000007`,
        amount: rec7.amount,
        entity: AXILOGY_ENTITY,
        invoice: rec7.invoice,
        receipt: rec7._id,
        bankAccount: 'Axilogy Airwallex',
        createdBy: CREATED_BY,
      });
      console.log('  Created transaction for AX-REC-000007');
    }
  }

  // ── 4. Backfill transaction for REC-2026-0001 ──
  console.log('\n=== Backfill REC-2026-0001 ($5,000) ===');
  const rec2026 = await Receipt.findOne({ receiptNumber: 'REC-2026-0001' });
  if (!rec2026) {
    console.log('  Receipt not found, skipping');
  } else {
    const existingTxn2026 = await Transaction.findOne({ receipt: rec2026._id });
    if (existingTxn2026) {
      console.log('  Transaction already exists, skipping');
    } else {
      await Transaction.create({
        date: rec2026.paymentDate,
        type: 'income',
        category: 'Revenue',
        description: `Payment received — AX-INV-000010`,
        amount: rec2026.amount,
        entity: rec2026.entity || AXILOGY_ENTITY,
        invoice: rec2026.invoice,
        receipt: rec2026._id,
        bankAccount: rec2026.bankAccount || 'Axilogy Airwallex',
        createdBy: CREATED_BY,
      });
      console.log('  Created transaction for REC-2026-0001');
    }
  }

  // ── 5. Recompute all bank fund balances ──
  console.log('\n=== Recomputing fund balances ===');
  const bankFunds = await Fund.find({ type: 'bank' });
  for (const fund of bankFunds) {
    const results = await Transaction.aggregate([
      { $match: { bankAccount: fund.name } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);

    let income = 0;
    let expense = 0;
    for (const r of results) {
      if (r._id === 'income') income = r.total;
      if (r._id === 'expense') expense = r.total;
    }
    const net = income - expense;
    const newBalance = fund.openingBalance + net;

    console.log(`  ${fund.name}:`);
    console.log(`    Opening: $${(fund.openingBalance / 100).toFixed(2)}`);
    console.log(`    Income: $${(income / 100).toFixed(2)}, Expense: $${(expense / 100).toFixed(2)}`);
    console.log(`    Old balance: $${(fund.balance / 100).toFixed(2)} → New: $${(newBalance / 100).toFixed(2)}`);

    fund.balance = newBalance;
    await fund.save();
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
