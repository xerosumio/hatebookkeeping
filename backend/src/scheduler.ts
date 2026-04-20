import cron from 'node-cron';
import { RecurringItem } from './models/RecurringItem.js';
import { User } from './models/User.js';
import { getSettings } from './models/Settings.js';
import { sendEmail, buildRecurringReminderEmailHtml } from './utils/email.js';
import { env } from './config/env.js';
import { formatMoney } from './utils/pdf/formatMoney.js';
import { runSyncAll } from './services/airwallexSync.js';

function getNextDueDateForItem(item: {
  startDate: Date;
  frequency: string;
  dueDay: number;
  endDate?: Date | null;
  lastGeneratedDate?: Date | null;
}): Date | null {
  const now = new Date();
  if (item.endDate && item.endDate < now) return null;

  const freqMonths = item.frequency === 'monthly' ? 1 : item.frequency === 'quarterly' ? 3 : 12;
  const start = new Date(item.startDate);
  let cursor = new Date(start.getFullYear(), start.getMonth(), item.dueDay);

  while (cursor < now) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + freqMonths, item.dueDay);
  }
  return cursor;
}

function periodKey(d: Date, frequency: string): string {
  if (frequency === 'yearly') return `${d.getFullYear()}`;
  if (frequency === 'quarterly') return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3)}`;
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
}

async function runAlertCheck() {
  console.log('[scheduler] Running daily alert check...');
  try {
    const now = new Date();
    const items = await RecurringItem.find({
      active: true,
      startDate: { $lte: now },
    }).populate('client', 'name').populate('payee', 'name');

    const settings = await getSettings();
    const companyName = settings.companyName || 'HateBookkeeping';
    const admins = await User.find({ role: 'admin', active: true }).select('email name');
    const adminEmails = admins.map((a) => a.email).filter(Boolean);

    if (adminEmails.length === 0) {
      console.log('[scheduler] No admin emails configured, skipping alerts');
      return;
    }

    let alertsSent = 0;

    for (const item of items) {
      const nextDue = getNextDueDateForItem(item);
      if (!nextDue) continue;

      const alertDate = new Date(nextDue.getTime() - item.alertDaysBefore * 86400000);
      if (now < alertDate) continue;

      const pk = periodKey(nextDue, item.frequency);
      const alreadySent = item.history.some(
        (h) => h.action === 'alert_sent' && periodKey(h.date, item.frequency) === pk,
      );
      if (alreadySent) continue;

      const clientName = (item.client && typeof item.client === 'object') ? (item.client as any).name : '';
      const payeeName = (item.payee && typeof item.payee === 'object') ? (item.payee as any).name : '';

      const isIncome = item.type === 'income';
      const refId = isIncome ? item.lastGeneratedInvoice : item.lastGeneratedPaymentRequest;
      const detailUrl = refId
        ? `${env.frontendUrl}/#/${isIncome ? 'invoices' : 'payment-requests'}/${refId}`
        : `${env.frontendUrl}/#/recurring`;

      const html = buildRecurringReminderEmailHtml({
        companyName,
        itemName: item.name,
        type: item.type,
        invoiceNumber: undefined,
        requestNumber: undefined,
        clientName: isIncome ? clientName : undefined,
        payeeName: !isIncome ? payeeName : undefined,
        amount: formatMoney(item.amount),
        frequency: item.frequency,
        detailUrl,
        invoiceId: isIncome && item.lastGeneratedInvoice ? String(item.lastGeneratedInvoice) : undefined,
        isAlert: true,
        dueDate: nextDue.toLocaleDateString('en-HK', { year: 'numeric', month: 'short', day: 'numeric' }),
      });

      const subject = isIncome
        ? `Reminder: ${item.name} — Invoice due ${nextDue.toLocaleDateString()}`
        : `Reminder: ${item.name} — Payment due ${nextDue.toLocaleDateString()}`;

      const primary = adminEmails[0];
      const cc = adminEmails.slice(1);
      await sendEmail({
        to: primary,
        cc: cc.length > 0 ? cc : undefined,
        subject,
        html,
      }).catch(() => {});

      item.history.push({
        date: now,
        action: 'alert_sent',
        note: `Alert sent ${item.alertDaysBefore} day(s) before due date ${nextDue.toLocaleDateString()}`,
      } as any);
      await item.save();
      alertsSent++;
    }

    console.log(`[scheduler] Alert check complete — ${alertsSent} alert(s) sent`);
  } catch (err) {
    console.error('[scheduler] Alert check failed:', err);
  }
}

export function startScheduler() {
  cron.schedule('0 0 * * *', runAlertCheck, { timezone: 'Asia/Hong_Kong' });
  console.log('[scheduler] Daily alert cron started (08:00 HKT → 00:00 UTC)');

  cron.schedule('*/30 * * * *', runSyncAll, { timezone: 'Asia/Hong_Kong' });
  console.log('[scheduler] Airwallex sync cron started (every 30 min)');

  setTimeout(runAlertCheck, 5000);
  setTimeout(runSyncAll, 10000);
}
