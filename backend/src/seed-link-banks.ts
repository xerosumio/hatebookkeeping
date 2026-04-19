import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(scriptDir, '../.env') });

import { Transaction } from './models/Transaction.js';
import { Entity } from './models/Entity.js';
import './models/Invoice.js';
import './models/Payee.js';
import './models/PaymentRequest.js';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  const entities = await Entity.find({});
  console.log('\nConfigured entities and bank accounts:');
  for (const ent of entities) {
    console.log(`  ${ent.code} — ${ent.name} (${ent._id})`);
    for (const ba of (ent as any).bankAccounts || []) {
      console.log(`    Bank: ${ba.name} (${ba.bankName} ${ba.accountNumber})`);
    }
  }

  const entityMap = new Map<string, string>();
  for (const ent of entities) {
    const banks = (ent as any).bankAccounts || [];
    if (banks.length > 0) {
      entityMap.set(ent._id.toString(), banks[0].name);
    }
  }

  const allTxns = await Transaction.find({});
  const grouped: Record<string, number> = {};
  for (const t of allTxns) {
    const key = t.bankAccount || '(empty)';
    grouped[key] = (grouped[key] || 0) + 1;
  }
  console.log('\nCurrent bankAccount distribution:');
  for (const [k, v] of Object.entries(grouped)) console.log(`  "${k}": ${v}`);

  let updated = 0;
  for (const txn of allTxns) {
    if (!txn.entity) continue;
    const entityId = txn.entity.toString();
    const bankName = entityMap.get(entityId);
    if (bankName && txn.bankAccount !== bankName) {
      const old = txn.bankAccount || '(empty)';
      txn.bankAccount = bankName;
      await txn.save();
      updated++;
      if (updated <= 5) console.log(`  ${txn.description.slice(0, 40)}... "${old}" → "${bankName}"`);
    }
  }

  console.log(`\nUpdated ${updated} transactions with correct bank account`);
  await mongoose.disconnect();
  console.log('Done!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
