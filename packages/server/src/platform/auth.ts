import type { Request, RequestHandler } from 'express';
import { can, type Permission } from '@hbk/shared';
import { verifySession } from '../modules/auth/tokens.js';
import { User, type UserDoc } from '../modules/users/model.js';
import { AppError, forbidden } from './errors.js';

export interface AuthContext {
  user: UserDoc;
  jti: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

/** Every route except sign-in and the health check sits behind this. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  (async () => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new AppError(401, 'Sign in to continue.');
    const { userId, jti } = await verifySession(header.slice(7));
    const user = await User.findById(userId);
    if (!user || !user.active) throw new AppError(401, 'Your sign-in has ended. Sign in again.');
    req.auth = { user, jti };
  })().then(() => next(), next);
};

/** Passes when the signed-in user's role holds at least one of the permissions. */
export function requirePermission(...permissions: Permission[]): RequestHandler {
  return (req, _res, next) => {
    const role = req.auth?.user.role;
    if (permissions.some((permission) => can(role, permission))) return next();
    next(forbidden());
  };
}

export function currentUser(req: Request): UserDoc {
  if (!req.auth) throw new AppError(401, 'Sign in to continue.');
  return req.auth.user;
}

export function allowed(req: Request, permission: Permission): boolean {
  return can(req.auth?.user.role, permission);
}
