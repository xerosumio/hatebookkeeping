import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(scriptDir, '../.env') });

import { Shareholder } from './models/Shareholder.js';
import { ShareLiability } from './models/ShareLiability.js';
import { EquityTransaction } from './models/EquityTransaction.js';
import { User } from './models/User.js';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  const admin = await User.findOne({ role: 'admin' });
  if (!admin) throw new Error('No admin user found');
  console.log(`Using admin: ${admin.name}`);

  const existing = await ShareLiability.countDocuments();
  if (existing > 0) {
    console.log(`Already ${existing} liability entries exist. Skipping migration.`);
    await mongoose.disconnect();
    return;
  }

  // --- Kelly ---
  const kelly = await Shareholder.findOne({ name: /kelly/i });
  if (kelly) {
    const kellyOwed = 4430985;
    const kellyPaid = 64910;
    await ShareLiability.create({
      shareholder: kelly._id, type: 'purchase', amount: kellyOwed,
      date: kelly.createdAt, description: 'Initial share purchase', createdBy: admin._id,
    });
    if (kellyPaid > 0) {
      await ShareLiability.create({
        shareholder: kelly._id, type: 'payment', amount: kellyPaid,
        date: kelly.createdAt, description: 'Cash payment', createdBy: admin._id,
      });
    }
    console.log(`Kelly: purchase=${kellyOwed / 100}, payment=${kellyPaid / 100}, outstanding=${(kellyOwed - kellyPaid) / 100}`);
  }

  // --- Tristan ---
  const tristan = await Shareholder.findOne({ name: /tristan/i });
  if (tristan) {
    const tristanOwed = 4571690;
    const tristanPaid = 2345474;
    await ShareLiability.create({
      shareholder: tristan._id, type: 'purchase', amount: tristanOwed,
      date: tristan.createdAt, description: 'Initial share purchase', createdBy: admin._id,
    });
    if (tristanPaid > 0) {
      await ShareLiability.create({
        shareholder: tristan._id, type: 'payment', amount: tristanPaid,
        date: tristan.createdAt, description: 'Cash payment', createdBy: admin._id,
      });
    }
    console.log(`Tristan: purchase=${tristanOwed / 100}, payment=${tristanPaid / 100}, outstanding=${(tristanOwed - tristanPaid) / 100}`);
  }

  // --- Thomas ---
  const thomas = await Shareholder.findOne({ name: /thomas/i });
  if (thomas) {
    const thomasInitialOwed = 1965492;
    const thomasInitialPaid = 460626;

    await ShareLiability.create({
      shareholder: thomas._id, type: 'purchase', amount: thomasInitialOwed,
      date: thomas.createdAt, description: 'Initial share purchase', createdBy: admin._id,
    });
    if (thomasInitialPaid > 0) {
      await ShareLiability.create({
        shareholder: thomas._id, type: 'payment', amount: thomasInitialPaid,
        date: thomas.createdAt, description: 'Cash payment', createdBy: admin._id,
      });
    }
    console.log(`Thomas initial: purchase=${thomasInitialOwed / 100}, payment=${thomasInitialPaid / 100}`);

    // Compute total equity at current time for value-per-percent
    const allShareholders = await Shareholder.find({ active: true });
    let totalEquity = 0;
    for (const sh of allShareholders) {
      const lastTxn = await EquityTransaction.findOne({ shareholder: sh._id })
        .sort({ date: -1, createdAt: -1 });
      totalEquity += lastTxn?.balanceAfter ?? 0;
    }
    const valuePerPercent = totalEquity / 100;
    console.log(`Total equity: ${totalEquity / 100}, value per 1%: ${valuePerPercent / 100}`);

    // Find share transfers received by Thomas (history entries with "received from")
    const receivedTransfers = (thomas.shareHistory || []).filter((h) =>
      h.reason && h.reason.includes('received from'),
    );
    console.log(`Thomas received ${receivedTransfers.length} share transfer(s)`);

    for (const transfer of receivedTransfers) {
      const percentGained = transfer.newPercent - transfer.previousPercent;
      const purchaseValue = Math.round(percentGained * valuePerPercent);
      const fromMatch = transfer.reason.match(/received from (.+)\)/);
      const fromName = fromMatch ? fromMatch[1] : 'another shareholder';

      await ShareLiability.create({
        shareholder: thomas._id, type: 'purchase', amount: purchaseValue,
        date: transfer.date, description: `Purchased ${percentGained.toFixed(2)}% from ${fromName}`,
        createdBy: admin._id,
      });
      console.log(`  Transfer from ${fromName}: ${percentGained.toFixed(2)}% = ${purchaseValue / 100} HKD`);
    }

    // Summarize Thomas
    const thomasEntries = await ShareLiability.find({ shareholder: thomas._id });
    let totalOwed = 0;
    let totalPaid = 0;
    for (const e of thomasEntries) {
      if (e.type === 'purchase') totalOwed += e.amount;
      if (e.type === 'payment') totalPaid += e.amount;
    }
    console.log(`Thomas total: owed=${totalOwed / 100}, paid=${totalPaid / 100}, outstanding=${(totalOwed - totalPaid) / 100}`);
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
