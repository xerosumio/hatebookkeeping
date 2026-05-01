import mongoose from 'mongoose';
import { Fund } from './models/Fund.js';

async function repair() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  const AX_ENTITY = '69e4cc4ad80b3c6c435b8add';
  const AX_BANK_ID = '69e4ef4890ff929388243e89';
  const NL_BANK_ID = '69e4ef6c90ff929388243e8f';

  // 1. Fix Axilogy Staff Reserve: set missing entity
  const axStaff = await Fund.findOneAndUpdate(
    { name: 'Axilogy Staff Reserve' },
    { $set: { entity: new mongoose.Types.ObjectId(AX_ENTITY) } },
    { new: true },
  );
  if (axStaff) {
    console.log(`Fixed "Axilogy Staff Reserve" entity -> ${AX_ENTITY}`);
  }

  // 2. Add missing April staff reserve to AX (166394 cents = HK$ 1,663.94)
  if (axStaff) {
    await Fund.findByIdAndUpdate(axStaff._id, { $inc: { balance: 166394 } });
    console.log(`Added 166394 cents to "Axilogy Staff Reserve" (April 2026 staff reserve that was missed)`);
    const updated = await Fund.findById(axStaff._id).select('balance');
    console.log(`  New balance: ${updated!.balance} cents (HK$ ${(updated!.balance / 100).toFixed(2)})`);
  }

  // 3. Set heldIn for Share Purchase Pool funds
  const axPool = await Fund.findOneAndUpdate(
    { name: 'Share Purchase Pool - AX' },
    { $set: { heldIn: new mongoose.Types.ObjectId(AX_BANK_ID) } },
    { new: true },
  );
  if (axPool) console.log(`Set "Share Purchase Pool - AX" heldIn -> Axilogy Airwallex`);

  const nlPool = await Fund.findOneAndUpdate(
    { name: 'Share Purchase Pool - NL' },
    { $set: { heldIn: new mongoose.Types.ObjectId(NL_BANK_ID) } },
    { new: true },
  );
  if (nlPool) console.log(`Set "Share Purchase Pool - NL" heldIn -> Naton Airwallex`);

  await mongoose.disconnect();
  console.log('Done');
}

repair().catch((err) => {
  console.error(err);
  process.exit(1);
});
