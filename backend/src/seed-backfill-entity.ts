import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(scriptDir, '../.env') });

import { Transaction } from './models/Transaction.js';
import { PaymentRequest } from './models/PaymentRequest.js';
import { Entity } from './models/Entity.js';
import './models/Invoice.js';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  const ax = await Entity.findOne({ code: 'AX' });
  if (!ax) {
    console.error('Entity with code AX not found');
    process.exit(1);
  }
  console.log(`Found entity: ${ax.code} — ${ax.name} (${ax._id})`);

  const txResult = await Transaction.updateMany(
    { $or: [{ entity: { $exists: false } }, { entity: null }] },
    { $set: { entity: ax._id } },
  );
  console.log(`Transactions updated: ${txResult.modifiedCount}`);

  const prResult = await PaymentRequest.updateMany(
    { $or: [{ entity: { $exists: false } }, { entity: null }] },
    { $set: { entity: ax._id } },
  );
  console.log(`PaymentRequests updated: ${prResult.modifiedCount}`);

  // Also backfill invoices missing entity
  const Invoice = mongoose.model('Invoice');
  const invResult = await Invoice.updateMany(
    { $or: [{ entity: { $exists: false } }, { entity: null }] },
    { $set: { entity: ax._id } },
  );
  console.log(`Invoices updated: ${invResult.modifiedCount}`);

  await mongoose.disconnect();
  console.log('Done!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
