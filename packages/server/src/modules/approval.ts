import type { Model } from 'mongoose';
import { emailHtml, sendEmail, type EmailContent, type EmailResult } from '../integrations/email.js';
import { activityEntry, type Actor, type ApprovalAttrs } from '../platform/activity.js';
import { conflict, forbidden } from '../platform/errors.js';
import type { ApprovalPolicy } from './settings/service.js';
import { User, type UserDoc } from './users/model.js';

/**
 * The approval rules shared by quotes, expenses, claims and salary runs.
 * Status only moves through these checks; nothing sets a status by hand.
 */

export function isApprover(policy: ApprovalPolicy, userId: unknown): boolean {
  return policy.approverIds.includes(String(userId));
}

export function assertApproversChosen(policy: ApprovalPolicy): void {
  if (policy.approverIds.length === 0) {
    throw conflict('No approvers are chosen yet. An admin must choose them in Settings before anything can be submitted.');
  }
}

/** Why this person may not approve, or null when they may. */
export function approvalBlocker(
  policy: ApprovalPolicy,
  user: UserDoc,
  ownerIds: readonly string[],
  approvals: readonly ApprovalAttrs[],
): string | null {
  const userId = String(user._id);
  if (!isApprover(policy, userId)) return 'Only the approvers chosen in Settings can approve or reject.';
  if (ownerIds.includes(userId)) return 'You cannot approve your own item. Another approver has to do it.';
  if (approvals.some((approval) => String(approval.userId) === userId)) return 'You have already approved this.';
  return null;
}

export function assertMayApprove(
  policy: ApprovalPolicy,
  user: UserDoc,
  ownerIds: readonly string[],
  approvals: readonly ApprovalAttrs[],
): void {
  const blocker = approvalBlocker(policy, user, ownerIds, approvals);
  if (blocker) throw forbidden(blocker);
}

export function approvalEntry(user: UserDoc): ApprovalAttrs {
  return { userId: user._id, userName: user.name, at: new Date() };
}

export function isFullyApproved(policy: ApprovalPolicy, approvals: readonly ApprovalAttrs[]): boolean {
  return approvals.length >= policy.required;
}

async function emailsOf(userIds: readonly string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const users = await User.find({ _id: { $in: userIds }, active: true }).select('email');
  return users.map((user) => user.email);
}

/**
 * Emails people about a document and writes what really happened into the
 * document's history. A failed email is recorded as failed, never as sent.
 */
export async function notify(
  model: Model<any>,
  documentId: unknown,
  actor: Actor | null,
  recipientIds: readonly string[],
  subject: string,
  content: EmailContent,
): Promise<EmailResult> {
  const to = await emailsOf(recipientIds);
  const result = await sendEmail({ to, subject, html: emailHtml(content) });
  const action = result.status === 'sent' ? 'Email sent' : result.status === 'failed' ? 'Email failed' : 'Email not sent';
  await model.updateOne({ _id: documentId }, { $push: { activity: activityEntry(actor, action, result.detail) } });
  return result;
}

/** Approvers who still have to act: everyone chosen except the owners and those who approved. */
export function approversToAsk(
  policy: ApprovalPolicy,
  ownerIds: readonly string[],
  approvals: readonly ApprovalAttrs[] = [],
): string[] {
  const done = new Set(approvals.map((approval) => String(approval.userId)));
  return policy.approverIds.filter((id) => !ownerIds.includes(id) && !done.has(id));
}

/**
 * Refuses a submission that could never be approved: the people who wrote an
 * item cannot approve it, so enough other approvers must exist.
 */
export function assertCanReachApproval(policy: ApprovalPolicy, ownerIds: readonly string[]): void {
  assertApproversChosen(policy);
  const others = approversToAsk(policy, ownerIds).length;
  if (others < policy.required) {
    throw conflict(
      `This needs ${policy.required} approval${policy.required === 1 ? '' : 's'}, but only ${others} approver${others === 1 ? '' : 's'} ` +
        'other than the people who prepared it can give one. An admin must choose more approvers in Settings.',
    );
  }
}
