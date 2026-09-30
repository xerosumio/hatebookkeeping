import { createHash, randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { AppError } from '../middleware/errorHandler.js';
import { LoginTicket } from '../models/LoginTicket.js';
import { PendingWebLogin, type PendingWebLoginLean } from '../models/PendingWebLogin.js';

const PENDING_TTL_MS = 10 * 60 * 1000;
const TICKET_TTL_MS = 2 * 60 * 1000;

function hashTicket(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function beginWebLogin(args: {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo?: string;
}): Promise<void> {
  await PendingWebLogin.create({
    state: args.state,
    nonce: args.nonce,
    codeVerifier: args.codeVerifier,
    returnTo: args.returnTo ?? null,
    expiresAt: new Date(Date.now() + PENDING_TTL_MS),
  });
}

export async function takePendingWebLogin(state: string): Promise<PendingWebLoginLean> {
  const pending = await PendingWebLogin.findOneAndDelete({
    state,
    expiresAt: { $gt: new Date() },
  }).lean<PendingWebLoginLean>();

  if (!pending) {
    throw new AppError(400, 'There is no sign-in in progress. Start again from /api/auth/login.');
  }
  return pending;
}

export async function issueLoginTicket(args: { userId: string; returnTo: string }): Promise<string> {
  const raw = randomBytes(32).toString('base64url');
  await LoginTicket.create({
    ticketHash: hashTicket(raw),
    userId: new Types.ObjectId(args.userId),
    returnTo: args.returnTo,
    expiresAt: new Date(Date.now() + TICKET_TTL_MS),
  });
  return raw;
}

export async function consumeLoginTicket(raw: string): Promise<{ userId: string; returnTo: string }> {
  const ticket = raw.trim();
  if (!ticket) {
    throw new AppError(400, 'This sign-in ticket is missing.');
  }

  const row = await LoginTicket.findOneAndUpdate(
    {
      ticketHash: hashTicket(ticket),
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { consumedAt: new Date() } },
  ).lean<{ userId: Types.ObjectId; returnTo: string }>();

  if (!row) {
    throw new AppError(400, 'That sign-in ticket has expired or was already used. Start again from /api/auth/login.');
  }

  return { userId: row.userId.toString(), returnTo: row.returnTo };
}
