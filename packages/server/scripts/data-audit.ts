import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(scriptDir, '../.env') });

import { Transaction } from './models/Transaction.js';
import { Invoice } from './models/Invoice.js';
import { Receipt } from './models/Receipt.js';
import { Fund } from './models/Fund.js';
import { Quotation } from './models/Quotation.js';
import { getBalances } from './services/airwallex.js';

let issues = 0;

function warn(msg: string) {
  issues++;
  console.log(`  ⚠ ${msg}`);
}

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB\n');

  // ── 1. Receipt → Transaction linkage ──
  console.log('=== 1. Every receipt should have a linked transaction ===');
  const receipts = await Receipt.find().lean();
  let receiptsOk = 0;
  for (const r of receipts) {
    const txn = await Transaction.findOne({ receipt: r._id });
    if (!txn) {
      warn(`Receipt ${(r as any).receiptNumber} ($${((r as any).amount / 100).toFixed(2)}) has NO linked transaction`);
    } else {
      receiptsOk++;
    }
  }
  ok(`${receiptsOk}/${receipts.length} receipts have linked transactions`);

  // ── 2. Receipt → Invoice linkage ──
  console.log('\n=== 2. Every receipt should link to a valid invoice ===');
  let receiptInvOk = 0;
  for (const r of receipts) {
    if (!(r as any).invoice) {
      warn(`Receipt ${(r as any).receiptNumber} has no invoice reference`);
      continue;
    }
    const inv = await Invoice.findById((r as any).invoice);
    if (!inv) {
      warn(`Receipt ${(r as any).receiptNumber} → invoice ${(r as any).invoice} NOT FOUND (orphaned)`);
    } else {
      receiptInvOk++;
    }
  }
  ok(`${receiptInvOk}/${receipts.length} receipts link to valid invoices`);

  // ── 3. Transaction → Invoice/Receipt/PaymentRequest refs ──
  console.log('\n=== 3. Transaction reference integrity ===');
  const transactions = await Transaction.find().lean();
  let txnRefOk = 0;
  let txnWithRefs = 0;
  for (const t of transactions) {
    let hasRef = false;
    if (t.invoice) {
      hasRef = true;
      const inv = await Invoice.findById(t.invoice);
      if (!inv) warn(`Transaction ${t._id} (${t.description?.slice(0, 40)}) → invoice ${t.invoice} NOT FOUND`);
      else txnRefOk++;
    }
    if (t.receipt) {
      hasRef = true;
      const rec = await Receipt.findById(t.receipt);
      if (!rec) warn(`Transaction ${t._id} (${t.description?.slice(0, 40)}) → receipt ${t.receipt} NOT FOUND`);
      else txnRefOk++;
    }
    if (hasRef) txnWithRefs++;
  }
  ok(`${txnRefOk} valid refs out of ${txnWithRefs} transactions with refs (${transactions.length} total)`);

  // ── 4. Invoice amountPaid vs sum of receipts ──
  console.log('\n=== 4. Invoice amountPaid consistency ===');
  const invoices = await Invoice.find().lean();
  let invConsistent = 0;
  for (const inv of invoices) {
    const invReceipts = await Receipt.find({ invoice: inv._id }).lean();
    const receiptSum = invReceipts.reduce((s, r) => s + (r as any).amount, 0);
    if (inv.amountPaid !== receiptSum && invReceipts.length > 0) {
      warn(`Invoice ${inv.invoiceNumber}: amountPaid=$${(inv.amountPaid / 100).toFixed(2)} but sum(receipts)=$${(receiptSum / 100).toFixed(2)} (${invReceipts.length} receipts)`);
    } else {
      invConsistent++;
    }
  }
  ok(`${invConsistent}/${invoices.length} invoices have consistent amountPaid`);

  // ── 5. Invoice status consistency ──
  console.log('\n=== 5. Invoice status vs amountPaid/total ===');
  let statusOk = 0;
  for (const inv of invoices) {
    const expectedStatus =
      inv.amountPaid <= 0 ? 'unpaid' :
      inv.amountPaid >= inv.total ? 'paid' : 'partial';
    if (inv.status !== expectedStatus) {
      warn(`Invoice ${inv.invoiceNumber}: status="${inv.status}" but expected="${expectedStatus}" (paid=$${(inv.amountPaid / 100).toFixed(2)} / total=$${(inv.total / 100).toFixed(2)})`);
    } else {
      statusOk++;
    }
  }
  ok(`${statusOk}/${invoices.length} invoices have consistent status`);

  // ── 6. Quotation → Invoice linkage ──
  console.log('\n=== 6. Quotation → Invoice linkage ===');
  const quotations = await Quotation.find().lean();
  const invoicesWithQtn = await Invoice.find({ quotation: { $ne: null } }).lean();
  const qtnIds = new Set(quotations.map((q) => q._id.toString()));
  let qtnInvOk = 0;
  for (const inv of invoicesWithQtn) {
    if (qtnIds.has((inv as any).quotation?.toString())) {
      qtnInvOk++;
    } else {
      warn(`Invoice ${inv.invoiceNumber} → quotation ${(inv as any).quotation} NOT FOUND`);
    }
  }
  ok(`${qtnInvOk}/${invoicesWithQtn.length} invoices with quotation refs are valid`);
  ok(`${quotations.length} quotations total, ${invoicesWithQtn.length} invoices linked from quotations`);

  // ── 7. Fund balance verification ──
  console.log('\n=== 7. Fund balance = openingBalance + net(transactions) ===');
  const funds = await Fund.find({ type: 'bank' }).lean();
  for (const fund of funds) {
    const results = await Transaction.aggregate([
      { $match: { bankAccount: fund.name } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);
    let income = 0, expense = 0;
    for (const r of results) {
      if (r._id === 'income') income = r.total;
      if (r._id === 'expense') expense = r.total;
    }
    const expected = fund.openingBalance + income - expense;
    if (fund.balance !== expected) {
      warn(`Fund "${fund.name}": balance=$${(fund.balance / 100).toFixed(2)} but computed=$${(expected / 100).toFixed(2)}`);
    } else {
      ok(`Fund "${fund.name}": $${(fund.balance / 100).toFixed(2)} ✓ (opening=$${(fund.openingBalance / 100).toFixed(2)} + income=$${(income / 100).toFixed(2)} - expense=$${(expense / 100).toFixed(2)})`);
    }
  }

  // ── 8. Fund balance vs live Airwallex ──
  console.log('\n=== 8. Fund balance vs live Airwallex balance ===');
  try {
    const axBal = (await getBalances('ax')).find((b) => b.currency === 'HKD');
    const ntBal = (await getBalances('nt')).find((b) => b.currency === 'HKD');

    for (const { fundName, live } of [
      { fundName: 'Axilogy Airwallex', live: axBal?.total_amount ?? 0 },
      { fundName: 'Naton Airwallex', live: ntBal?.total_amount ?? 0 },
    ]) {
      const fund = funds.find((f) => f.name === fundName);
      const liveCents = Math.round(live * 100);
      const sysCents = fund?.balance ?? 0;
      const diff = sysCents - liveCents;
      if (Math.abs(diff) < 100) {
        ok(`${fundName}: system=$${(sysCents / 100).toFixed(2)} live=$${(liveCents / 100).toFixed(2)} ✓`);
      } else {
        const unreconciledTxns = await Transaction.find({
          bankAccount: fundName,
          reconciled: false,
        }).lean();
        const unreconciledNet = unreconciledTxns.reduce(
          (s, t) => s + (t.type === 'income' ? t.amount : -t.amount),
          0,
        );
        if (Math.abs(diff - unreconciledNet) < 100) {
          ok(`${fundName}: diff=$${(diff / 100).toFixed(2)} explained by ${unreconciledTxns.length} unreconciled txns (net=$${(unreconciledNet / 100).toFixed(2)})`);
        } else {
          warn(`${fundName}: system=$${(sysCents / 100).toFixed(2)} live=$${(liveCents / 100).toFixed(2)} diff=$${(diff / 100).toFixed(2)} UNEXPLAINED`);
        }
      }
    }
  } catch (err) {
    warn(`Could not fetch live balances: ${(err as Error).message.slice(0, 100)}`);
  }

  // ── 9. Orphaned records check ──
  console.log('\n=== 9. Orphaned records ===');
  const txnsWithReceipt = await Transaction.find({ receipt: { $ne: null } }).lean();
  let orphanedTxnReceipts = 0;
  for (const t of txnsWithReceipt) {
    const rec = await Receipt.findById(t.receipt);
    if (!rec) {
      orphanedTxnReceipts++;
      warn(`Transaction "${t.description?.slice(0, 40)}" → receipt ${t.receipt} DELETED`);
    }
  }
  if (!orphanedTxnReceipts) ok('No orphaned transaction→receipt refs');

  const txnsWithInvoice = await Transaction.find({ invoice: { $ne: null } }).lean();
  let orphanedTxnInvoices = 0;
  for (const t of txnsWithInvoice) {
    const inv = await Invoice.findById(t.invoice);
    if (!inv) {
      orphanedTxnInvoices++;
      warn(`Transaction "${t.description?.slice(0, 40)}" → invoice ${t.invoice} DELETED`);
    }
  }
  if (!orphanedTxnInvoices) ok('No orphaned transaction→invoice refs');

  // ── 10. Summary ──
  console.log('\n' + '='.repeat(50));
  console.log(`  DATA AUDIT COMPLETE`);
  console.log(`  Total issues: ${issues}`);
  console.log(`  Transactions: ${transactions.length}`);
  console.log(`  Invoices: ${invoices.length}`);
  console.log(`  Receipts: ${receipts.length}`);
  console.log(`  Quotations: ${quotations.length}`);
  console.log(`  Bank funds: ${funds.length}`);
  console.log('='.repeat(50));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
