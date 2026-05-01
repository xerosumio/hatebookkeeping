import mongoose from 'mongoose';
import { EquityTransaction } from './models/EquityTransaction.js';

async function repair() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  const result = await EquityTransaction.updateMany(
    { type: 'investment', description: /offset from distribution/i },
    { $set: { type: 'liability_offset' } },
  );

  console.log(`Updated ${result.modifiedCount} EquityTransaction(s) from "investment" to "liability_offset"`);

  await mongoose.disconnect();
  console.log('Done');
}

repair().catch((err) => {
  console.error(err);
  process.exit(1);
});
