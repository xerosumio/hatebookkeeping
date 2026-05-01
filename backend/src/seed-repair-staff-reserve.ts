import mongoose from 'mongoose';
import { Fund } from './models/Fund.js';

async function repair() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  // Reset AX Staff Reserve to April's amount only (March = 0, April = 166394)
  const axStaff = await Fund.findOneAndUpdate(
    { name: 'Axilogy Staff Reserve' },
    { $set: { balance: 166394 } },
    { new: true },
  );
  if (axStaff) {
    console.log(`Set "Axilogy Staff Reserve" balance to ${axStaff.balance} cents (HK$ ${(axStaff.balance / 100).toFixed(2)})`);
  } else {
    console.log('"Axilogy Staff Reserve" not found');
  }

  await mongoose.disconnect();
  console.log('Done');
}

repair().catch((err) => {
  console.error(err);
  process.exit(1);
});
