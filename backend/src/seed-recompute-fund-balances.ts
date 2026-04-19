import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(scriptDir, '../.env') });

import { Fund } from './models/Fund.js';
import { Transaction } from './models/Transaction.js';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  const bankFunds = await Fund.find({ type: 'bank' });
  console.log(`Found ${bankFunds.length} bank fund(s)`);

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

    const openingBalance = fund.balance - net;
    console.log(`\n${fund.name}:`);
    console.log(`  Current balance: ${fund.balance}`);
    console.log(`  Net transactions: ${net} (income: ${income}, expense: ${expense})`);
    console.log(`  Computed opening balance: ${openingBalance}`);

    fund.openingBalance = openingBalance;
    await fund.save();
    console.log(`  Saved openingBalance = ${openingBalance}`);
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
