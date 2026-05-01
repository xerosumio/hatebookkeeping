import mongoose from 'mongoose';
import { Fund } from './models/Fund.js';

async function repair() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  const result = await Fund.updateMany(
    { name: /company reserve/i, type: 'reserve' },
    { $set: { active: false } },
  );

  console.log(`Deactivated ${result.modifiedCount} Company Reserve fund(s)`);

  const funds = await Fund.find({ name: /company reserve/i }).select('name active balance');
  for (const f of funds) {
    console.log(`  ${f.name} | active=${f.active} | balance=${f.balance}`);
  }

  await mongoose.disconnect();
  console.log('Done');
}

repair().catch((err) => {
  console.error(err);
  process.exit(1);
});
