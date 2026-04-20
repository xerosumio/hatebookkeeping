import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(scriptDir, '../.env') });

const PaymentRequest = mongoose.model('PaymentRequest', new mongoose.Schema({}, { strict: false }));
const Transaction = mongoose.model('Transaction', new mongoose.Schema({}, { strict: false }));

const EXECUTE_IDS = [
  'PAY-2026-0001', 'PAY-2026-0002', 'PAY-2026-0003', 'PAY-2026-0004',
  'PAY-2026-0005', 'PAY-2026-0006', 'PAY-2026-0007', 'PAY-2026-0008',
  'PAY-2026-0009', 'PAY-2026-0010', 'PAY-2026-0011',
];

const SKIP_IDS = ['PAY-2026-0012', 'PAY-2026-0014'];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected\n');

  for (const rn of EXECUTE_IDS) {
    const pr = await PaymentRequest.findOne({ requestNumber: rn });
    if (!pr) {
      console.log(`  ${rn}: NOT FOUND`);
      continue;
    }

    const doc = pr.toObject() as any;
    if (doc.status === 'executed') {
      console.log(`  ${rn}: already executed`);
      continue;
    }

    // Link existing transactions to this payment request
    const txns = await Transaction.find({
      description: doc.items[0]?.description,
      bankAccount: 'Axilogy Airwallex',
      type: 'expense',
    });

    if (txns.length > 0) {
      for (const txn of txns) {
        await Transaction.updateOne(
          { _id: txn._id },
          { $set: { paymentRequest: pr._id } },
        );
      }
      console.log(`  ${rn}: linked ${txns.length} existing transaction(s)`);
    }

    // Mark as executed without creating new transactions
    await PaymentRequest.updateOne(
      { _id: pr._id },
      {
        $set: {
          status: 'executed',
          executedAt: new Date(),
        },
        $push: {
          activityLog: {
            action: 'executed',
            user: new mongoose.Types.ObjectId('69e4cc4ad80b3c6c435b8af4'),
            timestamp: new Date(),
            note: 'Marked executed during Airwallex reconciliation',
          },
        },
      },
    );
    console.log(`  ${rn}: → executed (${doc.items[0]?.description} $${(doc.totalAmount / 100).toFixed(2)})`);
  }

  console.log('\nSkipped (not executed):');
  for (const rn of SKIP_IDS) {
    const pr = await PaymentRequest.findOne({ requestNumber: rn });
    if (pr) {
      const doc = pr.toObject() as any;
      console.log(`  ${rn}: ${doc.status} — ${doc.items[0]?.description} $${(doc.totalAmount / 100).toFixed(2)}`);
    }
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
