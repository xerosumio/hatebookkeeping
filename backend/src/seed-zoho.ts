import mongoose from 'mongoose';
import { Entity } from './models/Entity.js';
import { User } from './models/User.js';
import { Client } from './models/Client.js';
import { Quotation } from './models/Quotation.js';
import { Invoice } from './models/Invoice.js';
import { Receipt } from './models/Receipt.js';
import { Transaction } from './models/Transaction.js';
import { Counter } from './models/Counter.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hatebookkeeping';

async function seed() {
  await mongoose.connect(MONGO_URI, { dbName: 'hatebookkeeping', authSource: 'admin' });
  console.log('Connected to MongoDB');

  // ── Find Axilogy entity and Thomas user ──
  const axilogy = await Entity.findOne({ code: 'AX' });
  if (!axilogy) throw new Error('Axilogy entity not found — run seed-demo.ts first');
  const thomas = await User.findOne({ email: 'thomas@awato.group' });
  if (!thomas) throw new Error('Thomas user not found — run seed-demo.ts first');

  const entityId = axilogy._id;
  const userId = thomas._id;

  // ── Clients ──
  const clientMap: Record<string, any> = {};
  const clientsData = [
    { name: 'DIYIXIAN COM LIMITED' },
    { name: 'Sign House Co Ltd', email: 'signhousehk@gmail.com' },
    { name: 'Ebony Household Limited', email: 'business@ebonyhousehold.com' },
    { name: 'Mr. Yu' },
    { name: 'Mr. Allan Chan' },
    { name: 'Aquaseason Professionals Limited' },
    { name: 'Profolium Technology Limited' },
    { name: 'Naton Lab Limited' },
    { name: 'AWATO Group' },
  ];

  for (const cd of clientsData) {
    const existing = await Client.findOne({ name: cd.name });
    if (existing) {
      clientMap[cd.name] = existing;
    } else {
      clientMap[cd.name] = await Client.create({
        name: cd.name,
        email: (cd as any).email || '',
        contactPerson: '',
        phone: '',
        address: '',
        notes: 'Imported from Zoho Books (Axilogy)',
        createdBy: userId,
      });
    }
  }
  console.log(`Created/found ${Object.keys(clientMap).length} clients`);

  // ── Quotations ──
  const quotationMap: Record<string, any> = {};

  const quotationsData = [
    {
      number: 'AX-QT-000001',
      client: 'DIYIXIAN COM LIMITED',
      title: 'Penetration Testing Services',
      status: 'accepted' as const,
      date: '2026-02-23',
      validUntil: '2026-03-31',
      notes: 'Looking forward for your business.',
      termsAndConditions: '1. Payment Terms\n- 100% upon delivery of final report\n\n2. Confidentiality\nAll findings and reports are confidential and will only be shared with authorized client personnel.\n\n3. Liability\nTesting will be performed in a controlled manner to avoid service disruption.',
      lineItems: [
        { description: 'Penetration Testing Services', quantity: 1, unitPrice: 900000, amount: 900000 },
      ],
      subtotal: 900000,
      total: 900000,
    },
    {
      number: 'AX-QT-000002',
      client: 'Sign House Co Ltd',
      title: 'AI Floor Plan Completion',
      status: 'accepted' as const,
      date: '2026-02-23',
      validUntil: '2026-03-23',
      notes: 'Looking forward for your business.',
      lineItems: [
        { description: 'Completion Cost', quantity: 1, unitPrice: 3000000, amount: 3000000 },
      ],
      subtotal: 3000000,
      total: 3000000,
    },
    {
      number: 'AX-QT-000003',
      client: 'Ebony Household Limited',
      title: 'Ebony Website Phase 2',
      status: 'accepted' as const,
      date: '2026-02-23',
      validUntil: '2026-03-23',
      notes: 'Looking forward for your business.',
      lineItems: [
        { description: 'Phase 2 Development', quantity: 1, unitPrice: 2000000, amount: 2000000 },
      ],
      subtotal: 2000000,
      total: 2000000,
    },
    {
      number: 'AX-QT-000004',
      client: 'Ebony Household Limited',
      title: 'Ebony Phase 3 Deposit',
      status: 'accepted' as const,
      date: '2026-02-23',
      validUntil: '2026-03-23',
      notes: 'Looking forward for your business.',
      lineItems: [
        { description: 'Phase 3 Deposit', quantity: 1, unitPrice: 500000, amount: 500000 },
      ],
      subtotal: 500000,
      total: 500000,
    },
    {
      number: 'AX-QT-000005',
      client: 'Mr. Yu',
      title: 'GLG & TLG Website',
      status: 'accepted' as const,
      date: '2026-02-23',
      validUntil: '2026-03-23',
      notes: 'Looking forward for your business.',
      lineItems: [
        { description: 'GLG & TLG Website Revamp', quantity: 1, unitPrice: 1500000, amount: 1500000 },
      ],
      subtotal: 1500000,
      total: 1500000,
    },
    {
      number: 'AX-QT-000006',
      client: 'Mr. Allan Chan',
      title: 'O365 Licenses',
      status: 'accepted' as const,
      date: '2026-02-23',
      validUntil: '2026-03-23',
      notes: 'Looking forward for your business.',
      lineItems: [
        { description: 'Beigehill IT Support', quantity: 3, unitPrice: 180000, amount: 540000 },
      ],
      subtotal: 540000,
      total: 540000,
    },
    {
      number: 'AX-QT-000007',
      client: 'Aquaseason Professionals Limited',
      title: 'AI OCR Accounting Process',
      status: 'draft' as const,
      date: '2026-04-15',
      notes: '',
      termsAndConditions: '',
      lineItems: [
        { description: 'Foundation Development', quantity: 1, unitPrice: 500000, amount: 500000 },
      ],
      subtotal: 500000,
      total: 500000,
    },
    {
      number: 'AX-QT-000009',
      client: 'Profolium Technology Limited',
      title: 'Windows Server Upgrade, Migration, and Professional Services',
      status: 'draft' as const,
      date: '2026-04-16',
      validUntil: '2026-04-30',
      notes: 'Remarks\nAll software provided by End User',
      lineItems: [
        { description: 'Dell PowerEdge R260 Server\n*Product details as per attached', quantity: 2, unitPrice: 7000000, amount: 14000000 },
        { description: 'APC Smart UPS 3KVA 2U UPS [SMT3000RMI2UC]', quantity: 1, unitPrice: 2400000, amount: 2400000 },
        { description: 'Non-Office Hour VM Migration per Man-day\n- For Two New Servers OS Installation / Setup\n- For New 6-7 VM migration to New Servers\n- Install New VM installation for AD and AD Migration\n- Set up & Configure Veeam Backup to Two NAS for VM Backup\n- Estimated to be 6 Man-days (Max: 14 Man-days)', quantity: 6, unitPrice: 730000, amount: 4380000 },
        { description: 'Network Support per Man-day\n- Estimated to be 2 Man-days (Max: 5 Man-days)', quantity: 2, unitPrice: 730000, amount: 1460000 },
        { description: 'Non-Office Hour Cable Arrangement and Labeling Job', quantity: 1, unitPrice: 950000, amount: 950000 },
        { description: 'Project Management and Consultation (Waived)', quantity: 1, unitPrice: 0, amount: 0, waived: true },
      ],
      subtotal: 23190000,
      total: 23190000,
    },
  ];

  for (const q of quotationsData) {
    const existing = await Quotation.findOne({ quotationNumber: q.number });
    if (existing) {
      quotationMap[q.number] = existing;
      continue;
    }
    const items = q.lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount: li.amount,
      waived: (li as any).waived || false,
    }));
    quotationMap[q.number] = await Quotation.create({
      quotationNumber: q.number,
      entity: entityId,
      client: clientMap[q.client]._id,
      status: q.status,
      title: q.title,
      lineItems: items,
      subtotal: q.subtotal,
      discount: 0,
      discountPercent: 0,
      total: q.total,
      termsAndConditions: q.termsAndConditions || '',
      paymentSchedule: [],
      validUntil: q.validUntil ? new Date(q.validUntil) : undefined,
      notes: q.notes || '',
      createdBy: userId,
      createdAt: new Date(q.date),
    });
  }
  console.log(`Created ${Object.keys(quotationMap).length} quotations`);

  // ── Invoices ──
  const BANK_INFO = `Bank Details Account information:
Account name: Axilogy Limited
Bank account number: 7950133712
Bank code: 016
Branch code: 478
SWIFT code: DHBKHKHH
Bank name: DBS Bank (Hong Kong) Limited
Location: Hong Kong SAR`;

  const invoiceMap: Record<string, any> = {};

  const invoicesData = [
    {
      number: 'AX-INV-000001', client: 'DIYIXIAN COM LIMITED', quotation: 'AX-QT-000001',
      subject: 'Penetration Testing Services', date: '2026-03-02', dueDate: '2026-03-31',
      status: 'paid' as const, lastPaymentDate: '2026-03-02',
      lineItems: [{ description: 'Penetration Testing Services', quantity: 1, unitPrice: 900000, amount: 900000 }],
      subtotal: 900000, total: 900000,
    },
    {
      number: 'AX-INV-000002', client: 'Sign House Co Ltd', quotation: 'AX-QT-000002',
      subject: 'AI Floor Plan Completion', date: '2026-03-02', dueDate: '2026-03-31',
      status: 'paid' as const, lastPaymentDate: '2026-03-02',
      lineItems: [{ description: 'Completion Cost', quantity: 1, unitPrice: 3000000, amount: 3000000 }],
      subtotal: 3000000, total: 3000000,
    },
    {
      number: 'AX-INV-000004', client: 'Ebony Household Limited', quotation: 'AX-QT-000004',
      subject: 'Ebony Phase 3 Deposit', date: '2026-03-02', dueDate: '2026-04-01',
      status: 'paid' as const, lastPaymentDate: '2026-03-02',
      lineItems: [{ description: 'Phase 3 Deposit', quantity: 1, unitPrice: 500000, amount: 500000 }],
      subtotal: 500000, total: 500000,
    },
    {
      number: 'AX-INV-000005', client: 'Ebony Household Limited', quotation: 'AX-QT-000003',
      subject: 'Ebony Website Phase 2 Initial', date: '2026-03-02', dueDate: '2026-04-01',
      status: 'paid' as const, lastPaymentDate: '2026-03-02',
      lineItems: [{ description: 'Phase 2 Development Initial 50%', quantity: 1, unitPrice: 1000000, amount: 1000000 }],
      subtotal: 1000000, total: 1000000,
    },
    {
      number: 'AX-INV-000006', client: 'Mr. Yu', quotation: 'AX-QT-000005',
      subject: 'GLG & TLG Website', date: '2026-03-02', dueDate: '2026-04-01',
      status: 'paid' as const, lastPaymentDate: '2026-03-02',
      lineItems: [{ description: 'GLG & TLG Website Revamp Initial', quantity: 1, unitPrice: 1000000, amount: 1000000 }],
      subtotal: 1000000, total: 1000000,
    },
    {
      number: 'AX-INV-000007', client: 'Mr. Allan Chan', quotation: 'AX-QT-000006',
      subject: 'O365 Licenses', date: '2026-03-02', dueDate: '2026-04-01',
      status: 'paid' as const, lastPaymentDate: '2026-03-02',
      lineItems: [{ description: 'Beigehill IT Support', quantity: 3, unitPrice: 180000, amount: 540000 }],
      subtotal: 540000, total: 540000,
    },
    {
      number: 'AX-INV-000010', client: 'Mr. Yu', quotation: 'AX-QT-000005',
      subject: 'GLG & TLG Website', date: '2026-04-30', dueDate: '2026-05-30',
      status: 'unpaid' as const,
      lineItems: [{ description: 'GLG & TLG Website Revamp Completion', quantity: 1, unitPrice: 500000, amount: 500000 }],
      subtotal: 500000, total: 500000,
    },
    {
      number: 'AX-INV-000011', client: 'Ebony Household Limited', quotation: 'AX-QT-000003',
      subject: 'Ebony Website Phase 2', date: '2026-04-30', dueDate: '2026-05-30',
      status: 'unpaid' as const,
      lineItems: [{ description: 'Phase 2 Development Completion 50%', quantity: 1, unitPrice: 1000000, amount: 1000000 }],
      subtotal: 1000000, total: 1000000,
    },
    {
      number: 'AX-INV-000018', client: 'Naton Lab Limited',
      subject: 'Window Server Standard Core', date: '2026-03-27', dueDate: '2026-04-26',
      status: 'paid' as const, lastPaymentDate: '2026-04-08',
      lineItems: [{ description: 'Window Server Standard Core 2025', quantity: 4, unitPrice: 895000, amount: 3580000 }],
      subtotal: 3580000, total: 3580000,
    },
    {
      number: 'AX-INV-000019', client: 'Naton Lab Limited',
      subject: 'March Development', date: '2026-03-31', dueDate: '2026-04-30',
      status: 'unpaid' as const,
      lineItems: [{ description: 'One PM + One Dev', quantity: 5, unitPrice: 120000, amount: 600000 }],
      subtotal: 600000, total: 600000,
    },
    {
      number: 'AX-INV-000020', client: 'AWATO Group',
      subject: 'Investor Deposits', date: '2026-02-02', dueDate: '2026-02-02',
      status: 'paid' as const, lastPaymentDate: '2026-02-02',
      lineItems: [{ description: 'Investor Deposits', quantity: 1, unitPrice: 2059001, amount: 2059001 }],
      subtotal: 2059001, total: 2059001,
    },
    {
      number: 'AX-INV-000021', client: 'AWATO Group',
      subject: 'Reserved Pool Deposit', date: '2026-02-02', dueDate: '2026-02-02',
      status: 'paid' as const, lastPaymentDate: '2026-02-02',
      lineItems: [{ description: 'Reserved Pool Deposit', quantity: 1, unitPrice: 282564, amount: 282564 }],
      subtotal: 282564, total: 282564,
    },
    {
      number: 'AX-INV-000022', client: 'Aquaseason Professionals Limited',
      subject: 'AI OCR Development Fee', date: '2026-04-15', dueDate: '2026-04-30',
      status: 'unpaid' as const,
      lineItems: [{ description: 'April2026 Development fee', quantity: 1, unitPrice: 500000, amount: 500000 }],
      subtotal: 500000, total: 500000,
    },
  ];

  for (const inv of invoicesData) {
    const existing = await Invoice.findOne({ invoiceNumber: inv.number });
    if (existing) {
      invoiceMap[inv.number] = existing;
      continue;
    }

    const quotationRef = inv.quotation ? quotationMap[inv.quotation]?._id : undefined;
    const isPaid = inv.status === 'paid';

    invoiceMap[inv.number] = await Invoice.create({
      invoiceNumber: inv.number,
      entity: entityId,
      quotation: quotationRef,
      client: clientMap[inv.client]._id,
      status: inv.status,
      lineItems: inv.lineItems,
      subtotal: inv.subtotal,
      discount: 0,
      total: inv.total,
      amountPaid: isPaid ? inv.total : 0,
      amountDue: isPaid ? 0 : inv.total,
      milestone: inv.subject,
      paymentTerms: '',
      dueDate: new Date(inv.dueDate),
      notes: '',
      bankAccountInfo: BANK_INFO,
      createdBy: userId,
      createdAt: new Date(inv.date),
    });
  }
  console.log(`Created ${Object.keys(invoiceMap).length} invoices`);

  // ── Receipts + Income Transactions for paid invoices ──
  let receiptCount = 0;
  const paidInvoices = invoicesData.filter((inv) => inv.status === 'paid');

  for (const inv of paidInvoices) {
    const invoiceDoc = invoiceMap[inv.number];
    const receiptNumber = inv.number.replace('INV', 'REC');
    const existingReceipt = await Receipt.findOne({ receiptNumber });
    if (existingReceipt) continue;

    const paymentDate = new Date(inv.lastPaymentDate!);

    const receipt = await Receipt.create({
      receiptNumber,
      invoice: invoiceDoc._id,
      client: clientMap[inv.client]._id,
      amount: inv.total,
      paymentMethod: 'bank_transfer',
      paymentDate,
      bankReference: '',
      notes: `Imported from Zoho — ${inv.subject}`,
      createdBy: userId,
      createdAt: paymentDate,
    });

    await Transaction.create({
      date: paymentDate,
      type: 'income',
      category: 'Revenue',
      description: `${inv.subject} — ${inv.client}`,
      amount: inv.total,
      invoice: invoiceDoc._id,
      receipt: receipt._id,
      bankReference: '',
      bankAccount: 'DBS HKD',
      reconciled: true,
      createdBy: userId,
      createdAt: paymentDate,
    });

    receiptCount++;
  }
  console.log(`Created ${receiptCount} receipts + income transactions`);

  // ── Expense Transactions ──
  const categoryMap: Record<string, string> = {
    'Salaries and Employee Wages': 'Salary',
    'Cost of Goods Sold': 'Vendor Payment',
    'Employee Reimbursements': 'Reimbursement',
    'Furniture and Equipment': 'Other Expense',
    'IT and Internet Expenses': 'Utilities',
    'Office Expense': 'Rent',
  };

  const expensesData = [
    { date: '2026-04-05', desc: 'March Salary — Honnia Tse', account: 'Salaries and Employee Wages', amount: 2200000 },
    { date: '2026-04-05', desc: 'March Salary — Sai Peng', account: 'Salaries and Employee Wages', amount: 1000000 },
    { date: '2026-04-05', desc: 'Pen Test Commission — Carol Chow', account: 'Salaries and Employee Wages', amount: 900000 },
    { date: '2026-04-30', desc: "Beigehill Clients' licenses — Microsoft", account: 'Cost of Goods Sold', amount: 540000 },
    { date: '2026-04-05', desc: 'Meal with Duck Gor + Stamp — Thomas Pang', account: 'Employee Reimbursements', amount: 21900 },
    { date: '2026-04-05', desc: 'March Salary — Peggy', account: 'Salaries and Employee Wages', amount: 1000000 },
    { date: '2026-04-05', desc: 'Computer Reimbursement 2/20 — Honnia Tse', account: 'Furniture and Equipment', amount: 50000 },
    { date: '2026-04-05', desc: 'Computer Reimbursement 2/20 — Sai Peng', account: 'Furniture and Equipment', amount: 50000 },
    { date: '2026-04-05', desc: 'March Network Paid by Thomas — HKBN', account: 'IT and Internet Expenses', amount: 57400 },
    { date: '2026-04-05', desc: 'GLG Website Referral Commission — Oscar Wong', account: 'Salaries and Employee Wages', amount: 150000 },
    { date: '2026-04-05', desc: 'Felix commission for Sign House — Felix', account: 'Salaries and Employee Wages', amount: 2200000 },
    { date: '2026-04-30', desc: 'Adobe Pro, Dropbox, and O365 License for Beigehill — Microsoft', account: 'Cost of Goods Sold', amount: 2350000 },
    { date: '2026-04-30', desc: 'Windows Server 2025 Standard License Pack x2 — DYXnet', account: 'Cost of Goods Sold', amount: 1811400 },
    { date: '2026-04-05', desc: 'March Office Rental — KT Office Rental', account: 'Office Expense', amount: 260000 },
  ];

  let expenseCount = 0;
  for (const exp of expensesData) {
    await Transaction.create({
      date: new Date(exp.date),
      type: 'expense',
      category: categoryMap[exp.account] || 'Other Expense',
      description: exp.desc,
      amount: exp.amount,
      bankReference: '',
      bankAccount: 'DBS HKD',
      reconciled: false,
      createdBy: userId,
      createdAt: new Date(exp.date),
    });
    expenseCount++;
  }
  console.log(`Created ${expenseCount} expense transactions`);

  // ── Summary ──
  const totalIncome = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalExpense = expensesData.reduce((sum, exp) => sum + exp.amount, 0);

  console.log('\n═══════════════════════════════════════════');
  console.log('  Zoho Books Import — Axilogy Limited');
  console.log('═══════════════════════════════════════════');
  console.log(`  Clients:              ${Object.keys(clientMap).length}`);
  console.log(`  Quotations:           ${Object.keys(quotationMap).length}`);
  console.log(`  Invoices:             ${Object.keys(invoiceMap).length}`);
  console.log(`  Receipts:             ${receiptCount}`);
  console.log(`  Income transactions:  ${receiptCount} (HKD ${(totalIncome / 100).toFixed(2)})`);
  console.log(`  Expense transactions: ${expenseCount} (HKD ${(totalExpense / 100).toFixed(2)})`);
  console.log('');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
