import mongoose from 'mongoose';
import { Fund } from './models/Fund.js';
import { FundTransfer } from './models/FundTransfer.js';
import { MonthlyClose } from './models/MonthlyClose.js';
import { Entity } from './models/Entity.js';
import { User } from './models/User.js';

async function repair() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  // Find the NT entity
  const ntEntity = await Entity.findOne({ code: /^n/i });
  if (!ntEntity) {
    console.log('No NT/NL entity found. Listing all entities:');
    const all = await Entity.find().select('code name');
    console.log(all.map((e) => `${e.code} - ${e.name}`).join('\n'));
    await mongoose.disconnect();
    return;
  }
  console.log(`Found entity: ${ntEntity.code} - ${ntEntity.name}`);

  // Find the finalized monthly close for this entity
  const close = await MonthlyClose.findOne({
    entity: ntEntity._id,
    status: 'finalized',
    year: 2026,
    month: 4,
  });
  if (!close) {
    console.log('No finalized April 2026 close found for this entity');
    await mongoose.disconnect();
    return;
  }

  // Calculate total offset from distributions
  const offsetDists = close.distributions.filter(
    (d) => d.method === 'offset_liability' && d.liabilityOffset && d.liabilityOffset > 0,
  );
  if (offsetDists.length === 0) {
    console.log('No offset distributions found');
    await mongoose.disconnect();
    return;
  }

  const totalOffset = offsetDists.reduce((sum, d) => sum + (d.liabilityOffset || 0), 0);
  console.log(`Total offset amount: ${totalOffset} cents (HK$ ${(totalOffset / 100).toFixed(2)})`);
  console.log(`Offset shareholders: ${offsetDists.length}`);

  // Create the pool fund
  const entityCode = ntEntity.code.toUpperCase();
  const poolFundName = `Share Purchase Pool - ${entityCode}`;
  let poolFund = await Fund.findOne({ name: poolFundName });
  if (poolFund) {
    console.log(`Pool fund "${poolFundName}" already exists with balance ${poolFund.balance}`);
  } else {
    poolFund = await Fund.create({
      name: poolFundName,
      type: 'reserve',
      entity: ntEntity._id,
      openingBalance: 0,
      balance: totalOffset,
      active: true,
    });
    console.log(`Created "${poolFundName}" with balance ${totalOffset} cents (HK$ ${(totalOffset / 100).toFixed(2)})`);
  }

  // Create FundTransfer record
  const existingTransfer = await FundTransfer.findOne({
    reference: `monthly-close:${close._id}`,
    toFund: poolFund._id,
  });
  if (existingTransfer) {
    console.log('FundTransfer already exists, skipping');
  } else {
    const admin = await User.findOne({ role: 'admin' });
    await FundTransfer.create({
      toFund: poolFund._id,
      amount: totalOffset,
      date: new Date(2026, 3, 28),
      description: 'Share purchase offset from distribution — April 2026',
      reference: `monthly-close:${close._id}`,
      createdBy: admin!._id,
    });
    console.log('Created FundTransfer record');
  }

  await mongoose.disconnect();
  console.log('Done');
}

repair().catch((err) => {
  console.error(err);
  process.exit(1);
});
