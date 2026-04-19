import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(scriptDir, '../.env') });

import { Transaction } from './models/Transaction.js';
import { Payee } from './models/Payee.js';
import { PaymentRequest } from './models/PaymentRequest.js';
import { User } from './models/User.js';
import './models/Invoice.js';
import './models/Entity.js';

const EM_DASH = ' \u2014 ';

async function getOrCreatePayee(name: string, createdBy: mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId> {
  const trimmed = name.trim();
  let payee = await Payee.findOne({ name: { $regex: new RegExp(`^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
  if (!payee) {
    payee = await Payee.create({ name: trimmed, createdBy });
    console.log(`  Created payee: "${trimmed}"`);
  }
  return payee._id;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  const thomas = await User.findOne({ name: /Thomas/i });
  if (!thomas) {
    console.error('No user with name containing "Thomas" found');
    process.exit(1);
  }
  console.log(`Using user: ${thomas.name} (${thomas._id})`);

  const transactions = await Transaction.find()
    .populate('paymentRequest', 'sourceBankAccount items')
    .populate({ path: 'paymentRequest', populate: { path: 'items.payee', select: 'name' } });

  let updatedCount = 0;
  let payeesLinked = 0;
  let descriptionsClean = 0;
  let bankAccountsSet = 0;

  for (const txn of transactions) {
    let changed = false;

    // 1. For expense transactions: extract payee from description "desc — PayeeName"
    if (txn.type === 'expense' && !txn.payee && txn.description.includes(EM_DASH)) {
      const idx = txn.description.lastIndexOf(EM_DASH);
      const cleanDesc = txn.description.substring(0, idx).trim();
      const payeeName = txn.description.substring(idx + EM_DASH.length).trim();

      if (payeeName) {
        const payeeId = await getOrCreatePayee(payeeName, thomas._id);
        txn.payee = payeeId;
        txn.description = cleanDesc;
        payeesLinked++;
        descriptionsClean++;
        changed = true;
      }
    }

    // 2. For expense transactions with paymentRequest but no payee yet, try to extract from PR items
    if (txn.type === 'expense' && !txn.payee && txn.paymentRequest) {
      const pr = txn.paymentRequest as any;
      if (pr.items?.length) {
        const firstItem = pr.items[0];
        const payeeObj = firstItem?.payee;
        if (payeeObj && typeof payeeObj === 'object' && payeeObj._id) {
          txn.payee = payeeObj._id;
          payeesLinked++;
          changed = true;
        }
      }
    }

    // 3. Set bankAccount from paymentRequest.sourceBankAccount if missing
    if (!txn.bankAccount && txn.paymentRequest) {
      const pr = txn.paymentRequest as any;
      if (pr.sourceBankAccount) {
        txn.bankAccount = pr.sourceBankAccount;
        bankAccountsSet++;
        changed = true;
      }
    }

    if (changed) {
      await txn.save();
      updatedCount++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Total transactions scanned: ${transactions.length}`);
  console.log(`  Transactions updated: ${updatedCount}`);
  console.log(`  Payees linked: ${payeesLinked}`);
  console.log(`  Descriptions cleaned: ${descriptionsClean}`);
  console.log(`  Bank accounts set: ${bankAccountsSet}`);

  await mongoose.disconnect();
  console.log('Done!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
