import mongoose from 'mongoose';
import { Fund } from './models/Fund.js';
import { FundTransfer } from './models/FundTransfer.js';
import { MonthlyClose } from './models/MonthlyClose.js';
import { User } from './models/User.js';

async function repair() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  const AX_ENTITY = '69e4cc4ad80b3c6c435b8add';

  const staffFund = await Fund.findOne({ name: 'Axilogy Staff Reserve' });
  if (!staffFund) { console.log('Staff fund not found'); return; }

  const close = await MonthlyClose.findOne({ entity: AX_ENTITY, year: 2026, month: 4, status: 'finalized' });
  if (!close) { console.log('No finalized AX April close found'); return; }

  const existing = await FundTransfer.findOne({
    toFund: staffFund._id,
    reference: `monthly-close:${close._id}`,
  });
  if (existing) {
    console.log('FundTransfer already exists, skipping');
    await mongoose.disconnect();
    return;
  }

  const admin = await User.findOne({ role: 'admin' });

  await FundTransfer.create({
    toFund: staffFund._id,
    amount: close.staffReserve,
    date: new Date(2026, 3, 28),
    description: 'Staff reserve allocation — April 2026',
    reference: `monthly-close:${close._id}`,
    createdBy: admin!._id,
  });

  console.log(`Created FundTransfer: ${close.staffReserve} cents (HK$ ${(close.staffReserve / 100).toFixed(2)}) to Axilogy Staff Reserve`);

  await mongoose.disconnect();
  console.log('Done');
}

repair().catch((err) => {
  console.error(err);
  process.exit(1);
});
