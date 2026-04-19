import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from './models/User.js';
import { Client } from './models/Client.js';
import { Quotation } from './models/Quotation.js';
import { Invoice } from './models/Invoice.js';
import { Receipt } from './models/Receipt.js';
import { Transaction } from './models/Transaction.js';
import { Payee } from './models/Payee.js';
import { PaymentRequest } from './models/PaymentRequest.js';
import { Reimbursement } from './models/Reimbursement.js';
import { RecurringItem } from './models/RecurringItem.js';
import { Counter } from './models/Counter.js';
import { Settings } from './models/Settings.js';
import { Entity } from './models/Entity.js';
import { Shareholder } from './models/Shareholder.js';
import { EquityTransaction } from './models/EquityTransaction.js';
import { MonthlyClose } from './models/MonthlyClose.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://root:4EIFI87eFad5uzpvccOiXW95p4adEtkY1hEFdMQTLOcVP9yioGMYgKXIcKmm5Q6k@34.96.151.31:27017';

async function seed() {
  await mongoose.connect(MONGO_URI, { dbName: 'hatebookkeeping', authSource: 'admin' });
  console.log('Connected to MongoDB');

  // ── Clear ALL collections ──
  await Promise.all([
    User.deleteMany({}),
    Client.deleteMany({}),
    Quotation.deleteMany({}),
    Invoice.deleteMany({}),
    Receipt.deleteMany({}),
    Transaction.deleteMany({}),
    Payee.deleteMany({}),
    PaymentRequest.deleteMany({}),
    Reimbursement.deleteMany({}),
    RecurringItem.deleteMany({}),
    Counter.deleteMany({}),
    Settings.deleteMany({}),
    Entity.deleteMany({}),
    Shareholder.deleteMany({}),
    EquityTransaction.deleteMany({}),
    MonthlyClose.deleteMany({}),
  ]);
  console.log('Cleared all collections');

  // ── Entities ──
  const natonLab = await Entity.create({
    code: 'NL',
    name: 'Naton Lab Limited',
    address: 'Hong Kong',
    phone: '',
    email: 'lab@naton.io',
    website: 'https://www.naton.io/',
    logoUrl: '/api/uploads/naton-logo.jpeg',
    bankAccounts: [],
    companyChopUrl: '',
    signatureUrl: '',
    active: true,
  });

  const axilogy = await Entity.create({
    code: 'AX',
    name: 'Axilogy Limited',
    address: 'Hong Kong',
    phone: '',
    email: '',
    website: '',
    logoUrl: '',
    bankAccounts: [],
    companyChopUrl: '',
    signatureUrl: '',
    active: true,
  });
  console.log('Created 2 entities: Naton Lab Limited (NL), Axilogy Limited (AX)');

  // ── Settings (global — chart of accounts, default entity) ──
  await Settings.create({
    companyName: 'AWATO Group',
    companyAddress: 'Hong Kong',
    companyPhone: '',
    companyEmail: '',
    companyWebsite: '',
    logoUrl: '',
    bankAccounts: [],
    defaultEntityId: natonLab._id,
    chartOfAccounts: [
      { code: '4000', name: 'Revenue', type: 'income', active: true },
      { code: '4900', name: 'Other Income', type: 'income', active: true },
      { code: '5100', name: 'Salary', type: 'expense', active: true },
      { code: '5200', name: 'Reimbursement', type: 'expense', active: true },
      { code: '5300', name: 'Rent', type: 'expense', active: true },
      { code: '5400', name: 'Utilities', type: 'expense', active: true },
      { code: '5500', name: 'Software Subscription', type: 'expense', active: true },
      { code: '5600', name: 'Professional Fees', type: 'expense', active: true },
      { code: '5700', name: 'Tax', type: 'expense', active: true },
      { code: '5800', name: 'Vendor Payment', type: 'expense', active: true },
      { code: '5900', name: 'Other Expense', type: 'expense', active: true },
      { code: '6100', name: 'Shareholder Distribution', type: 'expense', active: true },
      { code: '6200', name: 'Shareholder Collection', type: 'income', active: true },
      { code: '6300', name: 'Company Reserve', type: 'expense', active: true },
      { code: '6400', name: 'Staff Reserve', type: 'expense', active: true },
    ],
  });
  console.log('Created global settings (AWATO Group)');

  // ── Users (5 shareholders) ──
  const hash = await bcrypt.hash('demo123', 12);

  const william = await User.create({
    email: 'william@awato.group', passwordHash: hash, name: 'William',
    role: 'admin', active: true, mustChangePassword: true,
  });
  const andy = await User.create({
    email: 'andy@awato.group', passwordHash: hash, name: 'Andy',
    role: 'admin', active: true, mustChangePassword: true,
  });
  const thomas = await User.create({
    email: 'thomas@awato.group', passwordHash: hash, name: 'Thomas',
    role: 'admin', active: true, mustChangePassword: true,
  });
  const kelly = await User.create({
    email: 'kelly@awato.group', passwordHash: hash, name: 'Kelly',
    role: 'user', active: true, mustChangePassword: true,
  });
  const tristan = await User.create({
    email: 'tristan@awato.group', passwordHash: hash, name: 'Tristan',
    role: 'user', active: true, mustChangePassword: true,
  });
  console.log('Created 5 users (all passwords: demo123)');

  // ── Shareholders ──
  const shareholderData = [
    { user: william._id, name: 'William', sharePercent: 36.15517769738430 },
    { user: andy._id, name: 'Andy', sharePercent: 36.15517769738430 },
    { user: thomas._id, name: 'Thomas', sharePercent: 13.35993406201920 },
    { user: kelly._id, name: 'Kelly', sharePercent: 7.78646371982760 },
    { user: tristan._id, name: 'Tristan', sharePercent: 6.54324682338453 },
  ];

  const shareholders = [];
  for (const sd of shareholderData) {
    const sh = await Shareholder.create(sd);
    shareholders.push(sh);
  }
  console.log('Created 5 shareholders');

  // ── Initial Investment: HKD 653,098.50 = 65,309,850 cents ──
  const TOTAL_INVESTMENT = 65309850; // cents
  const investmentDate = new Date('2024-01-01');

  // Calculate each shareholder's share, fixing rounding
  const rawAmounts = shareholders.map((sh) => ({
    sh,
    amount: Math.round(TOTAL_INVESTMENT * sh.sharePercent / 100),
  }));

  // Adjust rounding so sum = exactly TOTAL_INVESTMENT
  const rawSum = rawAmounts.reduce((sum, r) => sum + r.amount, 0);
  const diff = TOTAL_INVESTMENT - rawSum;
  if (diff !== 0) {
    rawAmounts[0].amount += diff; // assign rounding remainder to largest shareholder
  }

  for (const { sh, amount } of rawAmounts) {
    await EquityTransaction.create({
      type: 'investment',
      shareholder: sh._id,
      amount,
      date: investmentDate,
      description: 'Initial capital investment — AWATO Group',
      balanceAfter: amount,
      createdBy: thomas._id,
    });
  }

  const verifySum = rawAmounts.reduce((sum, r) => sum + r.amount, 0);
  console.log(`Created initial investment equity transactions (Total: ${verifySum} cents = HKD ${(verifySum / 100).toFixed(2)})`);

  // ── Summary ──
  console.log('\n═══════════════════════════════════════════');
  console.log('  AWATO Group — Real data seeded!');
  console.log('═══════════════════════════════════════════');
  console.log('\n  Login accounts (all passwords: demo123):');
  console.log('  ─────────────────────────────────────────');
  console.log('  william@awato.group  (Admin)');
  console.log('  andy@awato.group     (Admin)');
  console.log('  thomas@awato.group   (Admin)');
  console.log('  kelly@awato.group    (User)');
  console.log('  tristan@awato.group  (User)');
  console.log('\n  Entities:');
  console.log('  ─────────────────────────────────────────');
  console.log('  NL — Naton Lab Limited');
  console.log('  AX — Axilogy Limited');
  console.log('\n  Shareholders:');
  console.log('  ─────────────────────────────────────────');
  for (const { sh, amount } of rawAmounts) {
    console.log(`  ${sh.name}: ${sh.sharePercent.toFixed(2)}% — HKD ${(amount / 100).toFixed(2)}`);
  }
  console.log(`\n  Total Investment: HKD ${(verifySum / 100).toFixed(2)}`);
  console.log('');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
