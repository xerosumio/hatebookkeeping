import mongoose from 'mongoose';
import { Fund } from './models/Fund.js';

async function repair() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  // AX offset deducted Kelly (194343) + Tristan (163314) = 357657 cents
  const result = await Fund.findOneAndUpdate(
    { name: 'Axilogy Airwallex', type: 'bank' },
    { $inc: { balance: 357657 } },
    { new: true },
  );

  if (result) {
    console.log(`Repaired "Axilogy Airwallex" balance: now ${result.balance} cents (HK$ ${(result.balance / 100).toFixed(2)})`);
  } else {
    console.log('Fund "Axilogy Airwallex" not found');
  }

  // Also rename "Share Purchase Pool" to "Share Purchase Pool - AX" if it exists with wrong name
  const oldPool = await Fund.findOne({ name: 'Share Purchase Pool' });
  if (oldPool) {
    oldPool.name = 'Share Purchase Pool - AX';
    await oldPool.save();
    console.log('Renamed "Share Purchase Pool" -> "Share Purchase Pool - AX"');
  }

  await mongoose.disconnect();
  console.log('Done');
}

repair().catch((err) => {
  console.error(err);
  process.exit(1);
});
