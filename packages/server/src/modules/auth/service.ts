import { createHash, randomBytes } from 'node:crypto';
import type { OidcProfile } from '../../integrations/oidc.js';
import { AppError } from '../../platform/errors.js';
import { config } from '../../platform/runtime.js';
import { User, type UserDoc } from '../users/model.js';
import { LoginTicket, PendingLogin } from './models.js';

const PENDING_TTL_MS = 10 * 60 * 1000;
const TICKET_TTL_MS = 2 * 60 * 1000;

const hash = (raw: string) => createHash('sha256').update(raw).digest('hex');

export async function rememberPendingLogin(args: {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string | null;
}): Promise<void> {
  await PendingLogin.create({ ...args, expiresAt: new Date(Date.now() + PENDING_TTL_MS) });
}

export async function takePendingLogin(state: string) {
  const pending = await PendingLogin.findOneAndDelete({ state, expiresAt: { $gt: new Date() } }).lean();
  if (!pending) throw new AppError(400, 'There is no sign-in in progress. Start again.');
  return pending;
}

export async function issueLoginTicket(userId: string, returnTo: string): Promise<string> {
  const raw = randomBytes(32).toString('base64url');
  await LoginTicket.create({
    ticketHash: hash(raw),
    userId,
    returnTo,
    expiresAt: new Date(Date.now() + TICKET_TTL_MS),
  });
  return raw;
}

/** A ticket works once. The update that marks it used is the check. */
export async function consumeLoginTicket(raw: string): Promise<{ userId: string; returnTo: string }> {
  const ticket = raw.trim();
  if (!ticket) throw new AppError(400, 'This sign-in link is missing its ticket. Start again.');
  const row = await LoginTicket.findOneAndUpdate(
    { ticketHash: hash(ticket), consumedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { consumedAt: new Date() } },
  ).lean();
  if (!row) throw new AppError(400, 'That sign-in link has expired or was already used. Start again.');
  return { userId: String(row.userId), returnTo: row.returnTo };
}

const disabled = () => new AppError(403, 'This account has been switched off. Ask an admin to switch it back on.');

/**
 * Finds or creates the person who just signed in.
 *
 * - Members of the Authentik admin group are made admin. Not being in the
 *   group never takes a role away: a missing group claim must not demote
 *   every admin.
 * - With no admin group configured, the very first person to sign in becomes
 *   admin so that someone can set the app up.
 * - Everyone else starts as staff until an admin gives them another role.
 */
export async function upsertFromOidc(profile: OidcProfile): Promise<UserDoc> {
  const adminGroup = config().oidcAdminGroup;
  const inAdminGroup = adminGroup.length > 0 && profile.groups.includes(adminGroup);
  const email = profile.email.toLowerCase();

  const existing = (await User.findOne({ authentikId: profile.sub })) ?? (await User.findOne({ email }));
  if (existing) {
    if (!existing.active) throw disabled();
    existing.authentikId = profile.sub;
    existing.email = email;
    if (profile.name) existing.name = profile.name;
    if (inAdminGroup) existing.role = 'admin';
    existing.lastSignInAt = new Date();
    await existing.save();
    return existing;
  }

  let role: UserDoc['role'] = inAdminGroup ? 'admin' : 'staff';
  if (adminGroup.length === 0 && (await User.countDocuments({})) === 0) role = 'admin';

  return User.create({
    authentikId: profile.sub,
    email,
    name: profile.name ?? profile.email,
    role,
    active: true,
    lastSignInAt: new Date(),
  });
}
