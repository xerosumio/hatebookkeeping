import type { EmailStatus } from '@hbk/shared';
import { config } from '../platform/runtime.js';

export interface OutgoingEmail {
  to: string[];
  subject: string;
  html: string;
}

export interface EmailResult {
  status: EmailStatus;
  /** A sentence for the activity log: who it went to, or why it did not go. */
  detail: string;
}

/** Sends one email, or throws with the reason. */
export type EmailTransport = (email: OutgoingEmail) => Promise<void>;

let override: EmailTransport | null | undefined;

/** Tests swap the transport; `null` behaves as "email is not set up". */
export function setEmailTransport(transport: EmailTransport | null | undefined): void {
  override = transport;
}

function httpTransport(): EmailTransport | null {
  const { emailApiUrl, emailApiKey } = config();
  if (!emailApiUrl || !emailApiKey) return null;
  return async (email) => {
    const response = await fetch(`${emailApiUrl}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': emailApiKey },
      body: JSON.stringify({
        to: email.to[0],
        cc: email.to.length > 1 ? email.to.slice(1) : undefined,
        subject: email.subject,
        html: email.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const body = (await response.text().catch(() => '')).slice(0, 200);
      throw new Error(`the email service answered ${response.status}${body ? `: ${body}` : ''}`);
    }
  };
}

/**
 * Never throws: an email problem must not undo the action that triggered it.
 * The result says what really happened so the activity log can show it.
 */
export async function sendEmail(email: OutgoingEmail): Promise<EmailResult> {
  const to = [...new Set(email.to.map((address) => address.trim()).filter(Boolean))];
  if (to.length === 0) return { status: 'failed', detail: 'Email not sent: there was no one to send it to.' };

  const transport = override === undefined ? httpTransport() : override;
  if (!transport) return { status: 'not_configured', detail: 'Email not sent: email is not set up on the server.' };

  try {
    await transport({ ...email, to });
    return { status: 'sent', detail: `Email sent to ${to.join(', ')}.` };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[email] sending "${email.subject}" failed: ${reason}`);
    return { status: 'failed', detail: `Email to ${to.join(', ')} failed: ${reason}` };
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface EmailContent {
  heading: string;
  intro: string;
  rows?: [label: string, value: string][];
  link: { label: string; path: string };
}

/** One plain layout for every notification. All values are escaped. */
export function emailHtml(content: EmailContent): string {
  const url = new URL(content.link.path, config().webOrigin).toString();
  const rows = (content.rows ?? [])
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#64748b;white-space:nowrap">${escapeHtml(label)}</td>` +
        `<td style="padding:4px 0;color:#0f172a">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:24px">
    <h1 style="margin:0 0 8px;font-size:17px">${escapeHtml(content.heading)}</h1>
    <p style="margin:0 0 16px;color:#334155">${escapeHtml(content.intro)}</p>
    ${rows ? `<table style="border-collapse:collapse;margin:0 0 20px;font-size:13px">${rows}</table>` : ''}
    <a href="${escapeHtml(url)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;padding:9px 18px;border-radius:6px;text-decoration:none;font-weight:500">${escapeHtml(content.link.label)}</a>
    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">Sent by HateBookkeeping</p>
  </div>
</body></html>`;
}
