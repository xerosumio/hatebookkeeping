import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(scriptDir, '../.env') });

import { Transaction } from './models/Transaction.js';
import { Fund } from './models/Fund.js';
import { FundTransfer } from './models/FundTransfer.js';

const EntityModel = mongoose.model(
  'Entity',
  new mongoose.Schema({ code: String, name: String, bankAccounts: [mongoose.Schema.Types.Mixed], defaultBankAccountIndex: Number }, { strict: false }),
);

const RecurringItemModel = mongoose.model(
  'RecurringItem',
  new mongoose.Schema({ name: String, bankAccountInfo: String, entity: mongoose.Schema.Types.ObjectId }, { strict: false }),
);

const CANONICAL: Record<string, { fundName: string; accountNumber: string; bankName: string; bankCode: string; branchCode: string; swiftCode: string; location: string }> = {
  ax: {
    fundName: 'Axilogy Airwallex',
    accountNumber: '7950133712',
    bankName: 'DBS Bank (Hong Kong) Limited',
    bankCode: '016',
    branchCode: '478',
    swiftCode: 'DHBKHKHH',
    location: 'Hong Kong SAR',
  },
  nt: {
    fundName: 'Naton Airwallex',
    accountNumber: '47412428641',
    bankName: 'Standard Chartered Bank (Hong Kong) Ltd',
    bankCode: '003',
    branchCode: '474',
    swiftCode: 'SCBLHKHH',
    location: 'Hong Kong SAR',
  },
};

const OLD_AX_NAMES = ['Axilogy Limited', 'DBS HKD', 'Axilogy Airwallex'];
const OLD_NT_NAMES = ['Naton Lab Limited', 'Naton Airwallex'];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB\n');

  // --- Step 1: Fix Entity bank account names and details ---
  console.log('=== Step 1: Fixing Entity bank account names ===');
  const entities = await EntityModel.find({});
  const entityCodeToKey: Record<string, string> = {};

  for (const entity of entities) {
    const code = (entity.code || '').toUpperCase();
    const key = code === 'AX' ? 'ax' : code === 'NT' ? 'nt' : null;
    if (!key) {
      console.log(`  Skipping entity ${entity.name} (code: ${code}) — not AX or NT`);
      continue;
    }
    entityCodeToKey[String(entity._id)] = key;
    const canon = CANONICAL[key];
    const banks: any[] = entity.bankAccounts || [];

    let changed = false;
    for (const ba of banks) {
      const nameMatch = (key === 'ax' ? OLD_AX_NAMES : OLD_NT_NAMES).includes(ba.name);
      const numMatch = ba.accountNumber === canon.accountNumber;
      if (nameMatch || numMatch) {
        const oldName = ba.name;
        ba.name = canon.fundName;
        ba.bankName = canon.bankName;
        ba.accountNumber = canon.accountNumber;
        ba.bankCode = canon.bankCode;
        ba.branchCode = canon.branchCode;
        ba.swiftCode = canon.swiftCode;
        ba.location = canon.location;
        changed = true;
        console.log(`  Entity "${entity.name}" (${code}): renamed bank account "${oldName}" → "${canon.fundName}"`);
      }
    }

    if (changed) {
      await EntityModel.updateOne({ _id: entity._id }, { $set: { bankAccounts: banks } });
    }
  }

  // --- Step 2: Fix Transaction.bankAccount ---
  console.log('\n=== Step 2: Fixing Transaction.bankAccount values ===');
  for (const [key, canon] of Object.entries(CANONICAL)) {
    const oldNames = key === 'ax' ? OLD_AX_NAMES : OLD_NT_NAMES;
    const staleNames = oldNames.filter((n) => n !== canon.fundName);

    if (staleNames.length === 0) {
      console.log(`  ${canon.fundName}: no stale names to fix`);
      continue;
    }

    const result = await Transaction.updateMany(
      { bankAccount: { $in: staleNames } },
      { $set: { bankAccount: canon.fundName } },
    );
    console.log(`  ${canon.fundName}: updated ${result.modifiedCount} transactions (from: ${staleNames.join(', ')})`);
  }

  // --- Step 3: Fix RecurringItem.bankAccountInfo ---
  console.log('\n=== Step 3: Fixing RecurringItem.bankAccountInfo ===');
  const recurringItems = await RecurringItemModel.find({ bankAccountInfo: { $nin: ['', null] } });
  let recurringFixed = 0;

  for (const item of recurringItems) {
    const info = item.bankAccountInfo || '';
    if (!info) continue;

    let newInfo = info;
    for (const [key, canon] of Object.entries(CANONICAL)) {
      const oldNames = key === 'ax' ? OLD_AX_NAMES : OLD_NT_NAMES;
      for (const oldName of oldNames) {
        if (oldName === canon.fundName) continue;
        if (info.includes(oldName)) {
          newInfo = info.replace(oldName, canon.fundName);
        }
      }
    }

    if (newInfo !== info) {
      await RecurringItemModel.updateOne({ _id: item._id }, { $set: { bankAccountInfo: newInfo } });
      console.log(`  Recurring "${item.name}": "${info}" → "${newInfo}"`);
      recurringFixed++;
    }
  }
  console.log(`  Fixed ${recurringFixed} recurring items`);

  // --- Step 4: Recompute Fund balances ---
  console.log('\n=== Step 4: Recomputing Fund balances ===');
  const bankFunds = await Fund.find({ type: 'bank' });

  for (const fund of bankFunds) {
    const fundName = fund.name;
    const fundId = String(fund._id);

    const txnAgg = await Transaction.aggregate([
      { $match: { bankAccount: fundName } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);
    let txnIncome = 0;
    let txnExpense = 0;
    for (const r of txnAgg) {
      if (r._id === 'income') txnIncome = r.total;
      if (r._id === 'expense') txnExpense = r.total;
    }
    const txnNet = txnIncome - txnExpense;

    const transferInAgg = await FundTransfer.aggregate([
      { $match: { toFund: new mongoose.Types.ObjectId(fundId) } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const transferOutAgg = await FundTransfer.aggregate([
      { $match: { fromFund: new mongoose.Types.ObjectId(fundId) } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const transferIn = transferInAgg[0]?.total || 0;
    const transferOut = transferOutAgg[0]?.total || 0;
    const transferNet = transferIn - transferOut;

    const newBalance = fund.openingBalance + txnNet + transferNet;
    const oldBalance = fund.balance;

    if (oldBalance !== newBalance) {
      await Fund.updateOne({ _id: fund._id }, { $set: { balance: newBalance } });
      console.log(`  ${fundName}: ${oldBalance} → ${newBalance} (opening: ${fund.openingBalance}, txn net: ${txnNet}, transfer net: ${transferNet})`);
    } else {
      console.log(`  ${fundName}: balance OK at ${oldBalance}`);
    }
  }

  console.log('\n=== Done ===');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
