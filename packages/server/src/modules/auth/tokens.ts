import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { AppError } from '../../platform/errors.js';
import { config } from '../../platform/runtime.js';
import { Session } from './models.js';

export const WEB_TOKEN_PREFIX = 'hbk_web_';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const AUDIENCE = 'hbk:web';

function secret(): Uint8Array {
  return new TextEncoder().encode(config().sessionSecret);
}

const invalid = () => new AppError(401, 'Your sign-in has ended. Sign in again.');

export async function startSession(userId: string): Promise<string> {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await Session.create({ jti, userId, expiresAt });
  const jwt = await new SignJWT({ typ: 'hbk_web' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setAudience(AUDIENCE)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret());
  return WEB_TOKEN_PREFIX + jwt;
}

/** Checks the signature and expiry, then that the session has not been ended. */
export async function verifySession(raw: string): Promise<{ userId: string; jti: string }> {
  if (!raw.startsWith(WEB_TOKEN_PREFIX)) throw invalid();
  let userId: string;
  let jti: string;
  try {
    const { payload } = await jwtVerify(raw.slice(WEB_TOKEN_PREFIX.length), secret(), { audience: AUDIENCE });
    if (payload.typ !== 'hbk_web' || typeof payload.sub !== 'string' || typeof payload.jti !== 'string') {
      throw new Error('wrong token type');
    }
    userId = payload.sub;
    jti = payload.jti;
  } catch {
    throw invalid();
  }
  const session = await Session.exists({ jti, userId, expiresAt: { $gt: new Date() } });
  if (!session) throw invalid();
  return { userId, jti };
}

export async function endSession(jti: string): Promise<void> {
  await Session.deleteOne({ jti });
}

export async function endAllSessions(userId: string): Promise<void> {
  await Session.deleteMany({ userId });
}
