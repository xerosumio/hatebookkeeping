import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { env } from './config/env.js';
import { User } from './models/User.js';
import { Payee } from './models/Payee.js';
import { PaymentRequest } from './models/PaymentRequest.js';
import { getNextSequence } from './models/Counter.js';

const categoryMap: Record<string, string> = {
  'Salaries and Employee Wages': 'Salaries and Employee Wages',
  'Cost of Goods Sold': 'Cost of Goods Sold',
  'Employee Reimbursements': 'Employee Reimbursements',
  'Furniture and Equipment': 'Furniture and Equipment',
  'IT and Internet Expenses': 'IT and Internet Expenses',
  'Office Expense': 'Office Expense',
};

interface CsvRow {
  date: string;
  description: string;
  account: string;
  vendor: string;
  amount: number;
}

function parseCsv(filePath: string): CsvRow[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const rows: CsvRow[] = [];
  const lines: string[] = [];
  let current = '';

  for (const line of raw.split('\n')) {
    current += (current ? '\n' : '') + line;
    const quoteCount = (current.match(/"/g) || []).length;
    if (quoteCount % 2 === 0) {
      lines.push(current);
      current = '';
    }
  }
  if (current.trim()) lines.push(current);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields: string[] = [];
    let field = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(field);
        field = '';
      } else {
        field += ch;
      }
    }
    fields.push(field);

    const date = fields[0];
    const description = fields[1];
    const account = fields[2];
    const vendor = fields[6];
    const amountStr = fields[24];
    const amount = Math.round(parseFloat(amountStr) * 100);

    if (!date || !vendor || isNaN(amount)) continue;
    rows.push({ date, description, account, vendor, amount });
  }
  return rows;
}

async function seedExpenses() {
  await mongoose.connect(env.mongodbUri);
  console.log('Connected to MongoDB');

  const andy = await User.findOne({ name: 'Andy' });
  const thomas = await User.findOne({ name: 'Thomas' });
  if (!andy || !thomas) {
    console.error('Users Andy and/or Thomas not found. Run seed:demo first.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const csvPath = path.resolve(scriptDir, '../../Expense.csv');
  let finalPath = csvPath;
  if (!fs.existsSync(finalPath)) {
    finalPath = path.resolve(process.env.HOME || '~', 'Downloads/Expense.csv');
  }
  if (!fs.existsSync(finalPath)) {
    console.error(`Expense.csv not found at ${csvPath} or ~/Downloads/Expense.csv`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Reading CSV from ${finalPath}`);
  const rows = parseCsv(finalPath);
  console.log(`Parsed ${rows.length} expense rows`);

  const payeeCache = new Map<string, mongoose.Types.ObjectId>();

  for (const row of rows) {
    let payeeId = payeeCache.get(row.vendor);
    if (!payeeId) {
      let payee = await Payee.findOne({ name: row.vendor });
      if (!payee) {
        payee = await Payee.create({
          name: row.vendor,
          createdBy: thomas._id,
        });
        console.log(`  Created payee: ${row.vendor}`);
      }
      payeeId = payee._id as mongoose.Types.ObjectId;
      payeeCache.set(row.vendor, payeeId);
    }

    const category = categoryMap[row.account] || row.account;
    const requestNumber = await getNextSequence('pay');
    const now = new Date(row.date);

    await PaymentRequest.create({
      requestNumber,
      description: row.description,
      items: [{
        payee: payeeId,
        description: row.description,
        amount: row.amount,
        category,
        recipient: row.vendor,
      }],
      totalAmount: row.amount,
      sourceBankAccount: 'Bank Cash',
      status: 'approved',
      createdBy: thomas._id,
      approvedBy: andy._id,
      approvedAt: now,
      activityLog: [
        { action: 'created', user: thomas._id, timestamp: now },
        { action: 'approved', user: andy._id, timestamp: now },
      ],
    });

    console.log(`  Created expense: ${row.description} (${row.vendor}) — HKD ${(row.amount / 100).toFixed(2)}`);
  }

  console.log(`\nDone! Created ${rows.length} expense approval(s).`);
  await mongoose.disconnect();
}

seedExpenses().catch((err) => {
  console.error(err);
  process.exit(1);
});
