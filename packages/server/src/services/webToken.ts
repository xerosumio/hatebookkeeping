import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { getConfig } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

export const WEB_TOKEN_PREFIX = 'hbk_web_';
export const WEB_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const AUDIENCE = 'hbk:web';

export interface WebTokenClaims {
  userId: string;
  jti: string;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(getConfig().SESSION_SECRET);
}

export async function issueWebToken(userId: string): Promise<string> {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + WEB_TOKEN_TTL_SECONDS * 1000);
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

export async function verifyWebToken(raw: string): Promise<WebTokenClaims> {
  const token = raw.startsWith(WEB_TOKEN_PREFIX) ? raw.slice(WEB_TOKEN_PREFIX.length) : raw;
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: AUDIENCE });
    if (payload.typ !== 'hbk_web' || typeof payload.sub !== 'string' || !payload.sub) {
      throw new Error('wrong type');
    }
    const jti = typeof payload.jti === 'string' ? payload.jti : payload.sub;
    return { userId: payload.sub, jti };
  } catch {
    throw new AppError(401, 'The sign-in token is invalid or has expired.');
  }
}

export function looksLikeWebToken(value: string): boolean {
  return value.startsWith(WEB_TOKEN_PREFIX);
}
