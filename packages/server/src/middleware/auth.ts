import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../models/User.js';
import { AppError } from './errorHandler.js';
import { looksLikeWebToken, verifyWebToken } from '../services/webToken.js';

export interface AuthRequest extends Request {
  user?: IUser;
}

export async function authMiddleware(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AppError(401, 'No token provided');
    }

    const token = header.slice(7);

    let user;
    if (token.startsWith('hbk_') && !looksLikeWebToken(token)) {
      user = await User.findOne({ 'apiTokens.token': token, active: true });
      if (!user) throw new AppError(401, 'Invalid API token');
      await User.updateOne(
        { _id: user._id, 'apiTokens.token': token },
        { $set: { 'apiTokens.$.lastUsedAt': new Date() } },
      );
    } else if (looksLikeWebToken(token)) {
      const claims = await verifyWebToken(token);
      user = await User.findById(claims.userId);
      if (!user || !user.active) throw new AppError(401, 'Invalid token');
    } else {
      throw new AppError(401, 'Invalid token');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError(401, 'Invalid token'));
    }
  }
}

export function roleGuard(...roles: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError(403, 'Insufficient permissions'));
      return;
    }
    next();
  };
}
