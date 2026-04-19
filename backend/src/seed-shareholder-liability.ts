import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(scriptDir, '../.env') });

import { Shareholder } from './models/Shareholder.js';

const liabilities: { name: RegExp; owed: number; paid: number }[] = [
  { name: /kelly/i, owed: 4430985, paid: 64910 },
  { name: /tristan/i, owed: 4571690, paid: 2345474 },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  for (const l of liabilities) {
    const sh = await Shareholder.findOne({ name: l.name });
    if (!sh) {
      console.log(`Shareholder matching ${l.name} not found, skipping`);
      continue;
    }
    sh.sharePurchaseOwed = l.owed;
    sh.sharePurchasePaid = l.paid;
    await sh.save();
    const outstanding = (l.owed - l.paid) / 100;
    console.log(`${sh.name}: owed=${l.owed / 100}, paid=${l.paid / 100}, outstanding=${outstanding}`);
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
