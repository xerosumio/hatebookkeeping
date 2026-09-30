import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { User } from '../models/User.js';
import { getConfig } from '../config/env.js';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import * as oidc from '../auth/oidc.js';
import {
  beginWebLogin,
  consumeLoginTicket,
  issueLoginTicket,
  takePendingWebLogin,
} from '../services/webLoginService.js';
import { issueWebToken } from '../services/webToken.js';
import { upsertFromOidc } from '../services/userService.js';
import { resolveReturnTo } from '../api/origin.js';
import { accessFor } from '../access/policy.js';

const router = Router();

function publicUser(user: { _id: unknown; email: string; name: string; role: string; bankName?: string; bankAccountNumber?: string; fpsPhone?: string }) {
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    bankName: user.bankName,
    bankAccountNumber: user.bankAccountNumber,
    fpsPhone: user.fpsPhone,
  };
}

/** Begin a web sign-in. Redirects the browser to Authentik. */
router.get('/login', async (req, res, next) => {
  try {
    const cfg = getConfig();
    const redirectUri = new URL('/api/auth/callback', cfg.PUBLIC_URL).toString();
    const request = await oidc.beginAuthorization(redirectUri);

    await beginWebLogin({
      state: request.state,
      nonce: request.nonce,
      codeVerifier: request.codeVerifier,
      ...(typeof req.query.returnTo === 'string' ? { returnTo: req.query.returnTo } : {}),
    });

    res.redirect(request.url);
  } catch (error) {
    next(error);
  }
});

/** Authentik return leg on the API origin. Issues a one-time ticket and bounces to the SPA. */
router.get('/callback', async (req, res, next) => {
  try {
    const cfg = getConfig();
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!state) {
      throw new AppError(400, 'There is no sign-in in progress. Start again from /api/auth/login.');
    }

    const pending = await takePendingWebLogin(state);
    const profile = await oidc.completeAuthorization({
      currentUrl: new URL(req.originalUrl, cfg.PUBLIC_URL),
      expectedState: pending.state,
      expectedNonce: pending.nonce,
      codeVerifier: pending.codeVerifier,
    });

    const user = await upsertFromOidc(profile);
    const userId = user._id.toString();
    const returnTo = resolveReturnTo(pending.returnTo, cfg.webOrigin);
    const ticket = await issueLoginTicket({ userId, returnTo });

    const dest = new URL('/auth/callback', cfg.webOrigin);
    dest.searchParams.set('ticket', ticket);
    res.redirect(dest.toString());
  } catch (error) {
    next(error);
  }
});

/** Exchange the one-time login ticket for a web session token. */
router.post('/complete', async (req, res, next) => {
  try {
    const raw = typeof req.body?.ticket === 'string' ? req.body.ticket : '';
    const redeemed = await consumeLoginTicket(raw);
    const token = await issueWebToken(redeemed.userId);
    res.json({ token, returnTo: redeemed.returnTo });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (_req, res) => {
  res.status(204).end();
});

router.get('/me', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const access = await accessFor(req.user!);
    res.json({ ...publicUser(req.user!), access });
  } catch (error) {
    next(error);
  }
});

router.get('/tokens', authMiddleware, (req: AuthRequest, res) => {
  const tokens = (req.user!.apiTokens || []).map((t) => ({
    _id: t._id,
    name: t.name,
    tokenPreview: t.token.slice(0, 8) + '...' + t.token.slice(-4),
    createdAt: t.createdAt,
    lastUsedAt: t.lastUsedAt,
  }));
  res.json(tokens);
});

router.post('/tokens', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1).max(100) }).parse(req.body);
    const token = 'hbk_' + crypto.randomBytes(32).toString('hex');
    const user = req.user!;
    user.apiTokens.push({ token, name, createdAt: new Date(), lastUsedAt: null } as any);
    await user.save();
    res.status(201).json({ token, name });
  } catch (error) {
    next(error);
  }
});

router.delete('/tokens/:tokenId', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const user = req.user!;
    const idx = user.apiTokens.findIndex((t) => t._id.toString() === req.params.tokenId);
    if (idx === -1) throw new AppError(404, 'Token not found');
    user.apiTokens.splice(idx, 1);
    await user.save();
    res.json({ message: 'Token revoked' });
  } catch (error) {
    next(error);
  }
});

export { roleGuard };
export default router;
