import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(scriptDir, '../.env') });

import { Transaction } from './models/Transaction.js';
import { Fund } from './models/Fund.js';
import { Payee } from './models/Payee.js';

const AXILOGY_ENTITY = new mongoose.Types.ObjectId('69e4cc4ad80b3c6c435b8add');
const CREATED_BY = new mongoose.Types.ObjectId('69e4cc4ad80b3c6c435b8af4'); // Thomas Pang

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  // ── 1. Fix income dates to match bank deposit dates ──
  console.log('\n=== Fixing income dates ===');

  const incomeFixMap: Array<{ id: string; newDate: string; desc: string }> = [
    { id: '69e4d3520b733edb9fd1e474', newDate: '2026-03-03', desc: 'Ebony Phase 3 Deposit' },
    { id: '69e4d3520b733edb9fd1e479', newDate: '2026-03-03', desc: 'Ebony Website Phase 2 Initial' },
    { id: '69e4d3520b733edb9fd1e46f', newDate: '2026-03-03', desc: 'AI Floor Plan — Sign House' },
    { id: '69e4d3520b733edb9fd1e47e', newDate: '2026-03-10', desc: 'GLG & TLG Website — Mr. Yu' },
  ];

  for (const fix of incomeFixMap) {
    const res = await Transaction.updateOne(
      { _id: new mongoose.Types.ObjectId(fix.id) },
      { $set: { date: new Date(fix.newDate) } },
    );
    console.log(`  ${fix.desc}: ${res.modifiedCount ? 'updated' : 'no change'} → ${fix.newDate}`);
  }

  // ── 2. Split O365 Licenses into 3 separate entries ──
  console.log('\n=== Splitting O365 Licenses ===');

  const o365Id = '69e4d3520b733edb9fd1e483';
  const o365 = await Transaction.findById(o365Id);
  if (!o365) {
    console.log('  O365 transaction not found, skipping');
  } else {
    console.log(`  Deleting combined O365: ${o365.description} ($${o365.amount / 100})`);
    await Transaction.deleteOne({ _id: o365._id });

    const o365Entries = [
      { date: '2026-03-03', description: 'O365 License — Mai Feng (Hong Kong) Capital Limited' },
      { date: '2026-03-04', description: 'O365 License — Chao Galaxy Culture Media' },
      { date: '2026-03-06', description: 'O365 License — ATK Fund I LPF' },
    ];

    for (const entry of o365Entries) {
      await Transaction.create({
        date: new Date(entry.date),
        type: 'income',
        category: 'Revenue',
        description: entry.description,
        amount: 180000,
        entity: AXILOGY_ENTITY,
        bankAccount: 'Axilogy Airwallex',
        createdBy: CREATED_BY,
      });
      console.log(`  Created: ${entry.description} ($1,800) on ${entry.date}`);
    }
  }

  // ── 3. Add missing Beigehill income ──
  console.log('\n=== Adding Beigehill income ===');

  const existingBeigehill = await Transaction.findOne({
    type: 'income',
    amount: 3870000,
    bankAccount: 'Axilogy Airwallex',
  });

  if (existingBeigehill) {
    console.log('  Beigehill income already exists, skipping');
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
    console.log('  Created: Beigehill +$38,700 on 2026-02-16');
  }

  // ── 4. Fix expense dates to match bank transfer dates ──
  console.log('\n=== Fixing expense dates ===');

  // Apr 1 transfers: TSE Wing Hong (Honnia) and Wong Tin Chi/Andy (Sai Peng)
  const apr1Expenses = [
    { id: '69e4d3520b733edb9fd1e494', desc: 'March Salary — Honnia Tse' },
    { id: '69e4d3520b733edb9fd1e4a0', desc: 'Computer Reimbursement — Honnia Tse' },
    { id: '69e4d3520b733edb9fd1e496', desc: 'March Salary — Sai Peng' },
    { id: '69e4d3520b733edb9fd1e4a2', desc: 'Computer Reimbursement — Sai Peng' },
  ];

  for (const fix of apr1Expenses) {
    const res = await Transaction.updateOne(
      { _id: new mongoose.Types.ObjectId(fix.id) },
      { $set: { date: new Date('2026-04-01') } },
    );
    console.log(`  ${fix.desc}: ${res.modifiedCount ? 'updated' : 'no change'} → 2026-04-01`);
  }

  // Apr 13 transfers: Tam Kin Pong (Felix), Pang Chi Yuet (Thomas), Leung Wai Chung (Carol), Wong Tin Chi (Peggy+Oscar)
  const apr13Expenses = [
    { id: '69e4d3520b733edb9fd1e4a8', desc: 'Felix commission for Sign House' },
    { id: '69e4d3520b733edb9fd1e49c', desc: 'Meal with Duck Gor + Stamp — Thomas' },
    { id: '69e4d3520b733edb9fd1e4a4', desc: 'March Network Paid by Thomas — HKBN' },
    { id: '69e4d3520b733edb9fd1e498', desc: 'Pen Test Commission — Carol Chow' },
    { id: '69e4d3520b733edb9fd1e49e', desc: 'March Salary — Peggy' },
    { id: '69e4d3520b733edb9fd1e4a6', desc: 'GLG Website Referral Commission — Oscar' },
  ];

  for (const fix of apr13Expenses) {
    const res = await Transaction.updateOne(
      { _id: new mongoose.Types.ObjectId(fix.id) },
      { $set: { date: new Date('2026-04-13') } },
    );
    console.log(`  ${fix.desc}: ${res.modifiedCount ? 'updated' : 'no change'} → 2026-04-13`);
  }

  // ── 5. Add missing Feb 2026 salary expense (Andy / Wong Tin Chi) ──
  console.log('\n=== Adding Feb salary expense (Andy) ===');

  let andyPayee = await Payee.findOne({ name: /Andy/i });
  if (!andyPayee) {
    andyPayee = await Payee.create({
      name: 'Andy Leung',
      entity: AXILOGY_ENTITY,
      createdBy: CREATED_BY,
    });
    console.log('  Created payee: Andy Leung');
  }

  const existingFebSalary = await Transaction.findOne({
    type: 'expense',
    amount: 2520000,
    bankAccount: 'Axilogy Airwallex',
    description: { $regex: /Feb 2026/i },
  });

  if (existingFebSalary) {
    console.log('  Feb salary already exists, skipping');
  } else {
    await Transaction.create({
      date: new Date('2026-03-05'),
      type: 'expense',
      category: 'Salary',
      description: 'Feb 2026 Salary — Andy (Wong Tin Chi)',
      amount: 2520000,
      entity: AXILOGY_ENTITY,
      payee: andyPayee._id,
      bankAccount: 'Axilogy Airwallex',
      bankReference: 'P260305-4M0FOEL',
      createdBy: CREATED_BY,
    });
    console.log('  Created: Feb 2026 Salary -$25,200 on 2026-03-05');
  }

  // ── 6. Recompute Axilogy Airwallex fund balance ──
  console.log('\n=== Recomputing fund balance ===');

  const fund = await Fund.findOne({ name: 'Axilogy Airwallex', type: 'bank' });
  if (!fund) {
    console.log('  Fund not found');
  } else {
    const results = await Transaction.aggregate([
      { $match: { bankAccount: 'Axilogy Airwallex' } },
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

    console.log(`  Opening balance: ${fund.openingBalance} ($${fund.openingBalance / 100})`);
    console.log(`  Income total: ${income} ($${income / 100})`);
    console.log(`  Expense total: ${expense} ($${expense / 100})`);
    console.log(`  Net: ${net} ($${net / 100})`);
    console.log(`  Old balance: ${fund.balance} ($${fund.balance / 100})`);
    console.log(`  New balance: ${newBalance} ($${newBalance / 100})`);

    fund.balance = newBalance;
    await fund.save();
    console.log(`  Saved new balance: $${newBalance / 100}`);
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
