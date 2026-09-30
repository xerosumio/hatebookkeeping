import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { USER_PAGE_IDS } from '@hbk/shared';
import { resolvePolicy } from '../access/policy.js';
import { getSettings } from '../models/Settings.js';

const router = Router();

router.use(authMiddleware);

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'user']).optional(),
  active: z.boolean().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  fpsPhone: z.string().optional(),
  signatureUrl: z.string().optional(),
});

const accessSchema = z.object({
  pages: z.array(z.enum(USER_PAGE_IDS as unknown as [string, ...string[]])),
  seeAllReimbursements: z.boolean(),
  approve: z.boolean(),
  adjustFund: z.boolean(),
  approverIds: z.array(z.string()),
});

router.get('/access', roleGuard('admin'), async (_req, res, next) => {
  try {
    res.json(await resolvePolicy());
  } catch (error) {
    next(error);
  }
});

router.put('/access', roleGuard('admin'), async (req, res, next) => {
  try {
    const data = accessSchema.parse(req.body);
    const approverIds = [...new Set(data.approverIds)];
    const approvers = await User.find({ _id: { $in: approverIds }, active: true }).select('_id');
    if (approvers.length !== approverIds.length) {
      throw new AppError(400, 'Each approver must be an active user');
    }
    const settings = await getSettings();
    settings.userAccessConfigured = true;
    settings.userPages = data.pages;
    settings.userSeeAllReimbursements = data.seeAllReimbursements;
    settings.userCanApprove = data.approve;
    settings.userCanAdjustFund = data.adjustFund;
    settings.approverIds = approvers.map((user) => user._id);
    await settings.save();
    res.json(await resolvePolicy());
  } catch (error) {
    next(error);
  }
});

router.get('/', async (_req, res, next) => {
  try {
    const users = await User.find({}, '-passwordHash').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', roleGuard('admin'), async (req: AuthRequest, res, next) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError(404, 'User not found');

    if (data.email && data.email !== user.email) {
      const existing = await User.findOne({ email: data.email });
      if (existing) throw new AppError(409, 'Email already in use');
      user.email = data.email;
    }
    if (data.name) user.name = data.name;
    if (data.role) user.role = data.role;
    if (data.active !== undefined) user.active = data.active;
    if (data.bankName !== undefined) user.bankName = data.bankName;
    if (data.bankAccountNumber !== undefined) user.bankAccountNumber = data.bankAccountNumber;
    if (data.fpsPhone !== undefined) user.fpsPhone = data.fpsPhone;
    if (data.signatureUrl !== undefined) user.signatureUrl = data.signatureUrl;

    await user.save();
    const result = user.toObject();
    delete (result as { passwordHash?: string }).passwordHash;
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', roleGuard('admin'), async (req: AuthRequest, res, next) => {
  try {
    if (req.params.id === req.user!._id.toString()) {
      throw new AppError(400, 'Cannot deactivate yourself');
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true, select: '-passwordHash' },
    );

    if (!user) throw new AppError(404, 'User not found');
    res.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
