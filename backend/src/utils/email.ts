import { env } from '../config/env.js';

interface SendEmailOptions {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ status: string; jobId?: string }> {
  if (!env.emailApiKey) {
    console.warn('[email] No EMAIL_API_KEY configured – skipping email send');
    return { status: 'skipped' };
  }

  try {
    const res = await fetch(`${env.emailApiUrl}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.emailApiKey,
      },
      body: JSON.stringify({
        to: opts.to,
        cc: opts.cc,
        subject: opts.subject,
        html: opts.html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[email] Failed to send to ${opts.to}: ${res.status} ${err}`);
      return { status: 'failed' };
    }

    const data = await res.json();
    console.log(`[email] Queued email to ${opts.to} (job: ${data.jobId})`);
    return { status: data.status, jobId: data.jobId };
  } catch (err) {
    console.error('[email] Error sending email:', err);
    return { status: 'error' };
  }
}

export function buildPaymentRequestEmailHtml(params: {
  companyName: string;
  requestNumber: string;
  description: string;
  requesterName: string;
  createdAt: string;
  sourceBankAccount: string;
  items: Array<{ payeeName: string; description: string; category: string; amount: string }>;
  totalAmount: string;
  detailUrl: string;
  actionLabel?: string;
  actionMessage?: string;
}): string {
  const itemRows = params.items
    .map(
      (item, i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666">${i + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${item.payeeName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666">${item.description}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666">${item.category}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-family:monospace">${item.amount}</td>
    </tr>`,
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5">
  <div style="max-width:640px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#1e40af;padding:20px 24px;color:#fff">
      <h1 style="margin:0;font-size:18px;font-weight:600">${params.companyName}</h1>
    </div>
    <div style="padding:24px">
      ${params.actionMessage ? `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:12px 16px;margin-bottom:20px;color:#92400e;font-size:14px">${params.actionMessage}</div>` : ''}
      <h2 style="margin:0 0 16px;font-size:16px;color:#111">${params.actionLabel || 'Payment Request'} ${params.requestNumber}</h2>
      <table style="width:100%;font-size:13px;margin-bottom:20px">
        <tr>
          <td style="padding:4px 0;color:#888;width:140px">Requested By</td>
          <td style="padding:4px 0;font-weight:500">${params.requesterName}</td>
        </tr>
        ${params.description ? `<tr><td style="padding:4px 0;color:#888">Description</td><td style="padding:4px 0">${params.description}</td></tr>` : ''}
        <tr>
          <td style="padding:4px 0;color:#888">Date</td>
          <td style="padding:4px 0">${params.createdAt}</td>
        </tr>
        ${params.sourceBankAccount ? `<tr><td style="padding:4px 0;color:#888">Source Account</td><td style="padding:4px 0">${params.sourceBankAccount}</td></tr>` : ''}
      </table>

      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:8px 12px;text-align:left;font-weight:500;color:#666;border-bottom:2px solid #e5e7eb">#</th>
            <th style="padding:8px 12px;text-align:left;font-weight:500;color:#666;border-bottom:2px solid #e5e7eb">Payee</th>
            <th style="padding:8px 12px;text-align:left;font-weight:500;color:#666;border-bottom:2px solid #e5e7eb">Description</th>
            <th style="padding:8px 12px;text-align:left;font-weight:500;color:#666;border-bottom:2px solid #e5e7eb">Category</th>
            <th style="padding:8px 12px;text-align:right;font-weight:500;color:#666;border-bottom:2px solid #e5e7eb">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr style="background:#f9fafb">
            <td colspan="4" style="padding:10px 12px;text-align:right;font-weight:600;border-top:2px solid #e5e7eb">Total</td>
            <td style="padding:10px 12px;text-align:right;font-weight:700;font-family:monospace;border-top:2px solid #e5e7eb">${params.totalAmount}</td>
          </tr>
        </tfoot>
      </table>

      <div style="text-align:center;margin:24px 0 8px">
        <a href="${params.detailUrl}" style="display:inline-block;background:#1e40af;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">View Details</a>
      </div>
    </div>
    <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;color:#999;font-size:12px">
      Sent from ${params.companyName} via HateBookkeeping
    </div>
  </div>
</body>
</html>`;
}

export function getSubjectForRequest(requestNumber: string, isReply: boolean): string {
  const base = `[${requestNumber}] Payment Request`;
  return isReply ? `Re: ${base}` : base;
}

export function buildRecurringReminderEmailHtml(params: {
  companyName: string;
  itemName: string;
  type: 'income' | 'expense';
  invoiceNumber?: string;
  requestNumber?: string;
  clientName?: string;
  payeeName?: string;
  amount: string;
  frequency: string;
  detailUrl: string;
  invoiceId?: string;
  isAlert?: boolean;
  dueDate?: string;
}): string {
  const isIncome = params.type === 'income';
  const badge = isIncome
    ? '<span style="display:inline-block;background:#d1fae5;color:#059669;padding:4px 12px;border-radius:12px;font-weight:600;font-size:12px">INCOME</span>'
    : '<span style="display:inline-block;background:#fee2e2;color:#dc2626;padding:4px 12px;border-radius:12px;font-weight:600;font-size:12px">EXPENSE</span>';
  const refNumber = isIncome ? params.invoiceNumber : params.requestNumber;
  const counterparty = isIncome
    ? (params.clientName ? `<tr><td style="padding:4px 0;color:#888;width:140px">Client</td><td style="padding:4px 0;font-weight:500">${params.clientName}</td></tr>` : '')
    : (params.payeeName ? `<tr><td style="padding:4px 0;color:#888;width:140px">Payee</td><td style="padding:4px 0;font-weight:500">${params.payeeName}</td></tr>` : '');

  let actionMsg: string;
  if (params.isAlert) {
    const dueLine = params.dueDate ? ` Due date: <strong>${params.dueDate}</strong>.` : '';
    if (isIncome) {
      actionMsg = params.invoiceId
        ? `Reminder: <strong>${params.itemName}</strong> is coming due.${dueLine} An invoice has been generated — please review and send to the client.`
        : `Reminder: <strong>${params.itemName}</strong> is coming due.${dueLine} No invoice has been generated yet — please create one from the Recurring module.`;
    } else {
      actionMsg = `Reminder: <strong>${params.itemName}</strong> payment is coming due.${dueLine} Please ensure the payment request is submitted for approval.`;
    }
  } else {
    actionMsg = isIncome
      ? `Invoice <strong>${refNumber}</strong> has been auto-generated for <strong>${params.clientName || 'N/A'}</strong>. Please review and send to the client.`
      : `Payment request <strong>${refNumber}</strong> has been auto-created for <strong>${params.payeeName || 'N/A'}</strong> and is pending approval.`;
  }

  const invoiceLinks = isIncome && params.invoiceId
    ? `<div style="text-align:center;margin:8px 0 16px">
        <a href="${params.detailUrl}" style="display:inline-block;border:1px solid #1e40af;color:#1e40af;padding:8px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500">Open Invoice &amp; Download PDF</a>
      </div>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5">
  <div style="max-width:640px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#1e40af;padding:20px 24px;color:#fff">
      <h1 style="margin:0;font-size:18px;font-weight:600">${params.companyName}</h1>
    </div>
    <div style="padding:24px">
      <div style="margin-bottom:16px">${badge}</div>
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:12px 16px;margin-bottom:20px;color:#92400e;font-size:14px">
        ${actionMsg}
      </div>
      <h2 style="margin:0 0 16px;font-size:16px;color:#111">Recurring: ${params.itemName}</h2>
      <table style="width:100%;font-size:13px;margin-bottom:20px">
        ${counterparty}
        <tr><td style="padding:4px 0;color:#888;width:140px">Amount</td><td style="padding:4px 0;font-weight:600;font-family:monospace">${params.amount}</td></tr>
        <tr><td style="padding:4px 0;color:#888">Frequency</td><td style="padding:4px 0">${params.frequency}</td></tr>
        ${params.dueDate ? `<tr><td style="padding:4px 0;color:#888">Due Date</td><td style="padding:4px 0;font-weight:500">${params.dueDate}</td></tr>` : ''}
        ${refNumber ? `<tr><td style="padding:4px 0;color:#888">Reference</td><td style="padding:4px 0;font-weight:500">${refNumber}</td></tr>` : ''}
      </table>
      <div style="text-align:center;margin:24px 0 8px">
        <a href="${params.detailUrl}" style="display:inline-block;background:#1e40af;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">View Details</a>
      </div>
      ${invoiceLinks}
    </div>
    <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;color:#999;font-size:12px">
      Sent from ${params.companyName} via HateBookkeeping
    </div>
  </div>
</body>
</html>`;
}

export function buildMonthlyCloseEmailHtml(params: {
  companyName: string;
  entityName: string;
  monthLabel: string;
  openingCash: string;
  totalIncome: string;
  totalExpense: string;
  netProfit: string;
  availableCash: string;
  isLoss: boolean;
  shareholderDistribution: string;
  companyReserve: string;
  staffReserve: string;
  distributions: Array<{ name: string; sharePercent: number; amount: string; isNegative: boolean }>;
  detailUrl: string;
}): string {
  const actionBadge = params.isLoss
    ? '<span style="display:inline-block;background:#fee2e2;color:#dc2626;padding:6px 16px;border-radius:12px;font-weight:600;font-size:13px">INVESTORS NEED TO INJECT</span>'
    : '<span style="display:inline-block;background:#d1fae5;color:#059669;padding:6px 16px;border-radius:12px;font-weight:600;font-size:13px">READY TO DISTRIBUTE</span>';

  const distRows = params.distributions
    .map(
      (d) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${d.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${d.sharePercent.toFixed(2)}%</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-family:monospace;color:${d.isNegative ? '#dc2626' : '#059669'}">${d.isNegative ? '-' : ''}${d.amount}</td>
    </tr>`,
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5">
  <div style="max-width:640px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#1e40af;padding:20px 24px;color:#fff">
      <h1 style="margin:0;font-size:18px;font-weight:600">${params.companyName}</h1>
    </div>
    <div style="padding:24px">
      <div style="margin-bottom:16px;text-align:center">${actionBadge}</div>
      <h2 style="margin:0 0 16px;font-size:16px;color:#111;text-align:center">Monthly Close: ${params.entityName} - ${params.monthLabel}</h2>

      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:12px 16px;margin-bottom:20px;color:#92400e;font-size:14px">
        ${params.isLoss
          ? 'This month ended in a net shortfall. Investors are required to inject funds to cover the deficit.'
          : 'This month has distributable surplus. Funds will be distributed to shareholders after approval.'}
      </div>

      <table style="width:100%;font-size:13px;margin-bottom:20px">
        <tr><td style="padding:4px 0;color:#888;width:160px">Opening Cash</td><td style="padding:4px 0;font-family:monospace">${params.openingCash}</td></tr>
        <tr><td style="padding:4px 0;color:#888">Total Income</td><td style="padding:4px 0;font-family:monospace;color:#059669">+ ${params.totalIncome}</td></tr>
        <tr><td style="padding:4px 0;color:#888">Total Expenses</td><td style="padding:4px 0;font-family:monospace;color:#dc2626">- ${params.totalExpense}</td></tr>
        <tr><td style="padding:4px 0;color:#888">Net P&L</td><td style="padding:4px 0;font-weight:600;font-family:monospace">${params.netProfit}</td></tr>
        <tr><td colspan="2" style="border-top:1px solid #e5e7eb;padding:0;height:8px"></td></tr>
        <tr><td style="padding:4px 0;color:#888">Available Cash</td><td style="padding:4px 0;font-weight:700;font-family:monospace">${params.availableCash}</td></tr>
        ${!params.isLoss ? `
        <tr><td style="padding:4px 0;color:#888">Distribution (75%)</td><td style="padding:4px 0;font-family:monospace">${params.shareholderDistribution}</td></tr>
        <tr><td style="padding:4px 0;color:#888">Company Reserve (20%)</td><td style="padding:4px 0;font-family:monospace">${params.companyReserve}</td></tr>
        <tr><td style="padding:4px 0;color:#888">Staff Reserve (5%)</td><td style="padding:4px 0;font-family:monospace">${params.staffReserve}</td></tr>
        ` : ''}
      </table>

      <h3 style="font-size:14px;color:#333;margin:0 0 8px">${params.isLoss ? 'Collection per Shareholder' : 'Distribution per Shareholder'}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:8px 12px;text-align:left;font-weight:500;color:#666;border-bottom:2px solid #e5e7eb">Shareholder</th>
            <th style="padding:8px 12px;text-align:right;font-weight:500;color:#666;border-bottom:2px solid #e5e7eb">Share %</th>
            <th style="padding:8px 12px;text-align:right;font-weight:500;color:#666;border-bottom:2px solid #e5e7eb">Amount</th>
          </tr>
        </thead>
        <tbody>${distRows}</tbody>
      </table>

      <div style="text-align:center;margin:24px 0 8px">
        <a href="${params.detailUrl}" style="display:inline-block;background:#1e40af;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">Review & Approve</a>
      </div>
    </div>
    <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;color:#999;font-size:12px">
      Sent from ${params.companyName} via HateBookkeeping
    </div>
  </div>
</body>
</html>`;
}

export function buildStatusChangeEmailHtml(params: {
  companyName: string;
  requestNumber: string;
  requestLabel?: string;
  newStatus: 'approved' | 'rejected' | 'executed' | 'pending';
  actorName: string;
  reason?: string;
  bankReference?: string;
  detailUrl: string;
}): string {
  const statusMap: Record<string, { color: string; bg: string; label: string }> = {
    approved: { color: '#059669', bg: '#d1fae5', label: 'Approved' },
    rejected: { color: '#dc2626', bg: '#fee2e2', label: 'Rejected' },
    executed: { color: '#7c3aed', bg: '#ede9fe', label: 'Executed' },
    pending: { color: '#d97706', bg: '#fef3c7', label: 'Pending Approval' },
  };
  const { color: statusColor, bg: statusBg, label: statusLabel } = statusMap[params.newStatus];

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5">
  <div style="max-width:640px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#1e40af;padding:20px 24px;color:#fff">
      <h1 style="margin:0;font-size:18px;font-weight:600">${params.companyName}</h1>
    </div>
    <div style="padding:24px;text-align:center">
      <div style="display:inline-block;background:${statusBg};color:${statusColor};padding:8px 20px;border-radius:20px;font-weight:600;font-size:14px;margin-bottom:16px">
        ${statusLabel}
      </div>
      <h2 style="margin:0 0 8px;font-size:16px;color:#111">${params.requestLabel || 'Payment Request'} ${params.requestNumber}</h2>
      <p style="color:#666;font-size:14px;margin:0 0 4px">${statusLabel} by <strong>${params.actorName}</strong></p>
      ${params.reason ? `<p style="color:#92400e;background:#fef3c7;border-radius:6px;padding:10px 16px;font-size:13px;margin:12px 0;text-align:left"><strong>Reason:</strong> ${params.reason}</p>` : ''}
      ${params.bankReference ? `<p style="color:#4338ca;background:#eef2ff;border-radius:6px;padding:10px 16px;font-size:13px;margin:12px 0;text-align:left"><strong>Bank Reference:</strong> ${params.bankReference}</p>` : ''}
      <div style="margin:24px 0 8px">
        <a href="${params.detailUrl}" style="display:inline-block;background:#1e40af;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">View Details</a>
      </div>
    </div>
    <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;color:#999;font-size:12px">
      Sent from ${params.companyName} via HateBookkeeping
    </div>
  </div>
</body>
</html>`;
}
