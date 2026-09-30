import { USER_PAGE_IDS, type UserAccess, type UserPageId } from '@hbk/shared';
import { getSettings } from '../models/Settings.js';
import { User } from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AuthRequest } from '../middleware/auth.js';
import type { NextFunction, Response } from 'express';

const pageSet = new Set<string>(USER_PAGE_IDS);

export interface ResolvedPolicy {
  pages: UserPageId[];
  seeAllReimbursements: boolean;
  approve: boolean;
  adjustFund: boolean;
  approverIds: string[];
}

async function defaultApproverIds(): Promise<string[]> {
  const users = await User.find({
    role: 'admin',
    active: true,
    $or: [{ name: /^William/i }, { name: /^Andy/i }],
  }).select('_id');
  return users.map((user) => user._id.toString());
}

export async function resolvePolicy(): Promise<ResolvedPolicy> {
  const settings = await getSettings();
  if (!settings.userAccessConfigured) {
    return {
      pages: [...USER_PAGE_IDS],
      seeAllReimbursements: false,
      approve: false,
      adjustFund: false,
      approverIds: await defaultApproverIds(),
    };
  }
  const pages = (settings.userPages || []).filter((id): id is UserPageId => pageSet.has(id));
  return {
    pages,
    seeAllReimbursements: !!settings.userSeeAllReimbursements,
    approve: !!settings.userCanApprove,
    adjustFund: !!settings.userCanAdjustFund,
    approverIds: (settings.approverIds || []).map((id) => id.toString()),
  };
}

export async function accessFor(user: { _id: unknown; role: string }): Promise<UserAccess> {
  const policy = await resolvePolicy();
  const id = String(user._id);
  const isRequiredApprover = policy.approverIds.includes(id);
  if (user.role === 'admin') {
    return {
      pages: [...USER_PAGE_IDS],
      seeAllReimbursements: true,
      approve: true,
      adjustFund: true,
      isRequiredApprover,
    };
  }
  return {
    pages: policy.pages,
    seeAllReimbursements: policy.seeAllReimbursements,
    approve: policy.approve || isRequiredApprover,
    adjustFund: policy.adjustFund,
    isRequiredApprover,
  };
}

function deny(next: NextFunction) {
  next(new AppError(403, 'You do not have access to this'));
}

export function requirePage(...pages: UserPageId[]) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) return deny(next);
      if (req.user.role === 'admin') return next();
      const access = await accessFor(req.user);
      if (pages.some((page) => access.pages.includes(page))) return next();
      deny(next);
    } catch (error) {
      next(error);
    }
  };
}

export function requireCanApprove() {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) return deny(next);
      const access = await accessFor(req.user);
      if (access.approve) return next();
      deny(next);
    } catch (error) {
      next(error);
    }
  };
}

export async function assertAdjustFund(req: AuthRequest) {
  if (!req.user) throw new AppError(403, 'You do not have access to this');
  const access = await accessFor(req.user);
  if (!access.adjustFund) throw new AppError(403, 'You do not have access to this');
}
