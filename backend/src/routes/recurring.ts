import { Router } from 'express';
import { z } from 'zod';
import { RecurringItem } from '../models/RecurringItem.js';
import { Invoice } from '../models/Invoice.js';
import { PaymentRequest } from '../models/PaymentRequest.js';
import { User } from '../models/User.js';
import { getNextSequence } from '../models/Counter.js';
import { getSettings } from '../models/Settings.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { Entity } from '../models/Entity.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendEmail, buildRecurringReminderEmailHtml, buildPaymentRequestEmailHtml, getSubjectForRequest } from '../utils/email.js';
import { env } from '../config/env.js';
import { formatMoney } from '../utils/pdf/formatMoney.js';

const router = Router();
router.use(authMiddleware);

const recurringSchema = z.object({
  name: z.string().min(1),
  entity: z.string().optional(),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1),
  amount: z.number().int().positive(),
  frequency: z.enum(['monthly', 'quarterly', 'yearly']),
  client: z.string().optional(),
  payee: z.string().optional(),
  description: z.string().optional().default(''),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  active: z.boolean().optional().default(true),
  dueDay: z.number().int().min(1).max(28).optional().default(1),
  alertDaysBefore: z.number().int().min(0).optional().default(7),
  paymentTerms: z.string().optional().default(''),
  bankAccountInfo: z.string().optional().default(''),
});

function formatBankAccountDetails(ba: { name?: string; bankName?: string; accountNumber?: string; bankCode?: string; branchCode?: string; swiftCode?: string; location?: string }, entityName?: string): string {
  const lines: string[] = ['Airwallex Global Account information:'];
  lines.push(`Global Account name: ${entityName || ba.name || ''}`);
  if (ba.accountNumber) lines.push(`Bank account number: ${ba.accountNumber}`);
  if (ba.bankCode) lines.push(`Bank code: ${ba.bankCode}`);
  if (ba.branchCode) lines.push(`Branch code: ${ba.branchCode}`);
  if (ba.swiftCode) lines.push(`SWIFT code: ${ba.swiftCode}`);
  if (ba.bankName) lines.push(`Bank name: ${ba.bankName}`);
  if (ba.location) lines.push(`Location: ${ba.location}`);
  return lines.join('\n');
}

function computeDueDate(paymentTerms: string): Date {
  const now = new Date();
  if (paymentTerms === 'net_30') return new Date(now.getTime() + 30 * 86400000);
  if (paymentTerms === 'net_60') return new Date(now.getTime() + 60 * 86400000);
  return now;
}

async function generateInvoiceForItem(
  item: InstanceType<typeof RecurringItem>,
  userId: import('mongoose').Types.ObjectId,
) {
  const now = new Date();

  let entityId = item.entity;
  if (!entityId) {
    const settings = await getSettings();
    entityId = settings.defaultEntityId;
  }
  if (!entityId) throw new AppError(400, 'Recurring item has no entity and no default entity is configured');

  const entity = await Entity.findById(entityId);
  const entityCode = entity?.code;
  const invoiceNumber = await getNextSequence('inv', entityCode);
  const clientName = (item.client && typeof item.client === 'object') ? (item.client as any).name : '';
  const dueDate = computeDueDate(item.paymentTerms);

  let bankAccountInfo = item.bankAccountInfo || '';
  if (bankAccountInfo && entity?.bankAccounts?.length) {
    const match = entity.bankAccounts.find((ba) => {
      const label = [ba.name, ba.bankName, ba.accountNumber].filter(Boolean).join(' — ');
      return label === bankAccountInfo;
    });
    if (match) {
      bankAccountInfo = formatBankAccountDetails(match, entity?.name);
    }
  }
  if (!bankAccountInfo && entity?.bankAccounts?.length) {
    const defaultIdx = (entity as any).defaultBankAccountIndex || 0;
    const defaultBa = entity.bankAccounts[defaultIdx] || entity.bankAccounts[0];
    if (defaultBa) bankAccountInfo = formatBankAccountDetails(defaultBa, entity?.name);
  }

  const invoice = await Invoice.create({
    invoiceNumber,
    entity: entityId,
    client: item.client,
    status: 'draft',
    lineItems: [{
      description: item.name + (item.description ? ` — ${item.description}` : ''),
      quantity: 1,
      unitPrice: item.amount,
      amount: item.amount,
    }],
    subtotal: item.amount,
    discount: 0,
    total: item.amount,
    amountPaid: 0,
    amountDue: item.amount,
    paymentTerms: item.paymentTerms || '',
    bankAccountInfo,
    dueDate,
    notes: '',
    createdBy: userId,
  });

  item.lastGeneratedDate = now;
  item.lastGeneratedInvoice = invoice._id;
  item.history.push({
    date: now,
    action: 'generated_invoice',
    referenceId: invoice._id,
    referenceModel: 'Invoice',
    note: `Invoice ${invoiceNumber} auto-generated`,
  } as any);
  await item.save();

  return { invoice, invoiceNumber, clientName };
}

router.get('/', async (req, res, next) => {
  try {
    const { entity } = req.query;
    const filter: Record<string, unknown> = {};
    if (entity) filter.entity = entity;
    const items = await RecurringItem.find(filter)
      .populate('entity', 'code name')
      .populate('client', 'name')
      .populate('payee', 'name')
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = recurringSchema.parse(req.body);

    if (data.type === 'income' && !data.client) {
      throw new AppError(400, 'Client is required for income recurring items');
    }

    const item = await RecurringItem.create({
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      client: data.client || undefined,
      payee: data.payee || undefined,
      createdBy: req.user!._id,
    });

    const populated = await RecurringItem.findById(item._id)
      .populate('client', 'name')
      .populate('payee', 'name');
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = recurringSchema.parse(req.body);

    if (data.type === 'income' && !data.client) {
      throw new AppError(400, 'Client is required for income recurring items');
    }

    const item = await RecurringItem.findByIdAndUpdate(
      req.params.id,
      {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        client: data.client || null,
        payee: data.payee || null,
      },
      { new: true },
    );
    if (!item) throw new AppError(404, 'Recurring item not found');

    const populated = await RecurringItem.findById(item._id)
      .populate('client', 'name')
      .populate('payee', 'name');
    res.json(populated);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const item = await RecurringItem.findByIdAndDelete(req.params.id);
    if (!item) throw new AppError(404, 'Recurring item not found');
    res.json({ message: 'Recurring item deleted' });
  } catch (error) {
    next(error);
  }
});

router.post('/generate', async (req: AuthRequest, res, next) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const items = await RecurringItem.find({
      active: true,
      startDate: { $lte: monthEnd },
      $or: [{ endDate: null }, { endDate: { $gte: monthStart } }],
    }).populate('client', 'name').populate('payee', 'name');

    const settings = await getSettings();
    const companyName = settings.companyName || 'HateBookkeeping';
    const admins = await User.find({ role: 'admin', active: true }).select('email name');
    const adminEmails = admins.map((a) => a.email).filter(Boolean);

    const results: Array<{ itemName: string; type: string; action: string }> = [];

    for (const item of items) {
      if (!item.startDate) continue;
      if (item.lastGeneratedDate && item.lastGeneratedDate >= monthStart) continue;

      const monthsSinceStart = (now.getFullYear() - item.startDate.getFullYear()) * 12 +
        (now.getMonth() - item.startDate.getMonth());

      let shouldGenerate = false;
      if (item.frequency === 'monthly') shouldGenerate = true;
      else if (item.frequency === 'quarterly') shouldGenerate = monthsSinceStart % 3 === 0;
      else if (item.frequency === 'yearly') shouldGenerate = monthsSinceStart % 12 === 0;

      if (!shouldGenerate) continue;

      if (item.type === 'income') {
        const { invoice, invoiceNumber, clientName } = await generateInvoiceForItem(item, req.user!._id);

        if (adminEmails.length > 0) {
          const detailUrl = `${env.frontendUrl}/#/invoices/${invoice._id}`;
          const html = buildRecurringReminderEmailHtml({
            companyName,
            itemName: item.name,
            type: 'income',
            invoiceNumber,
            clientName,
            amount: formatMoney(item.amount),
            frequency: item.frequency,
            detailUrl,
            invoiceId: String(invoice._id),
          });
          const primary = adminEmails[0];
          const cc = adminEmails.slice(1);
          sendEmail({
            to: primary,
            cc: cc.length > 0 ? cc : undefined,
            subject: `[${invoiceNumber}] Recurring Invoice Auto-Generated`,
            html,
          }).catch(() => {});
        }

        results.push({ itemName: item.name, type: 'income', action: `Invoice ${invoiceNumber} created` });
      } else {
        const payRequestNumber = await getNextSequence('pay');
        const payeeName = (item.payee && typeof item.payee === 'object') ? (item.payee as any).name : 'N/A';

        const paymentRequest = await PaymentRequest.create({
          requestNumber: payRequestNumber,
          entity: item.entity,
          description: `[Recurring] ${item.name}${item.description ? ' — ' + item.description : ''}`,
          items: [{
            payee: item.payee || undefined,
            description: item.name + (item.description ? ` — ${item.description}` : ''),
            amount: item.amount,
            category: item.category,
            recipient: '',
          }],
          totalAmount: item.amount,
          sourceBankAccount: '',
          status: 'pending',
          createdBy: req.user!._id,
          activityLog: [{
            action: 'created',
            user: req.user!._id,
            timestamp: now,
            note: `Auto-created from recurring item: ${item.name}`,
          }],
        });

        item.lastGeneratedDate = now;
        item.lastGeneratedPaymentRequest = paymentRequest._id;
        item.history.push({
          date: now,
          action: 'generated_payment_request',
          referenceId: paymentRequest._id,
          referenceModel: 'PaymentRequest',
          note: `Payment request ${payRequestNumber} auto-created`,
        } as any);
        await item.save();

        if (adminEmails.length > 0) {
          const detailUrl = `${env.frontendUrl}/#/payment-requests/${paymentRequest._id}`;
          const html = buildRecurringReminderEmailHtml({
            companyName,
            itemName: item.name,
            type: 'expense',
            requestNumber: payRequestNumber,
            payeeName,
            amount: formatMoney(item.amount),
            frequency: item.frequency,
            detailUrl,
          });
          const primary = adminEmails[0];
          const cc = adminEmails.slice(1);
          sendEmail({
            to: primary,
            cc: cc.length > 0 ? cc : undefined,
            subject: `[${payRequestNumber}] Recurring Expense — Approval Required`,
            html,
          }).catch(() => {});

          paymentRequest.notifiedEmails = adminEmails;
          paymentRequest.activityLog.push({
            action: 'notified',
            user: req.user!._id,
            timestamp: new Date(),
            note: `Auto-notified admins: ${adminEmails.join(', ')}`,
          } as any);
          await paymentRequest.save();
        }

        results.push({ itemName: item.name, type: 'expense', action: `Payment request ${payRequestNumber} created` });
      }
    }

    res.json({ generated: results.length, results });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/generate-invoice', async (req: AuthRequest, res, next) => {
  try {
    const item = await RecurringItem.findById(req.params.id)
      .populate('client', 'name')
      .populate('payee', 'name');
    if (!item) throw new AppError(404, 'Recurring item not found');
    if (item.type !== 'income') throw new AppError(400, 'Only income recurring items can generate invoices');

    const { invoice, invoiceNumber, clientName } = await generateInvoiceForItem(item, req.user!._id);

    const settings = await getSettings();
    const companyName = settings.companyName || 'HateBookkeeping';
    const admins = await User.find({ role: 'admin', active: true }).select('email name');
    const adminEmails = admins.map((a) => a.email).filter(Boolean);

    if (adminEmails.length > 0) {
      const detailUrl = `${env.frontendUrl}/#/invoices/${invoice._id}`;
      const html = buildRecurringReminderEmailHtml({
        companyName,
        itemName: item.name,
        type: 'income',
        invoiceNumber,
        clientName,
        amount: formatMoney(item.amount),
        frequency: item.frequency,
        detailUrl,
        invoiceId: String(invoice._id),
      });
      const primary = adminEmails[0];
      const cc = adminEmails.slice(1);
      sendEmail({
        to: primary,
        cc: cc.length > 0 ? cc : undefined,
        subject: `[${invoiceNumber}] Recurring Invoice Generated`,
        html,
      }).catch(() => {});
    }

    res.json({ invoiceId: invoice._id, invoiceNumber });
  } catch (error) {
    next(error);
  }
});

export default router;
