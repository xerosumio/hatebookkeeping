import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Invoice } from '../models/Invoice.js';
import { Quotation } from '../models/Quotation.js';
import { PaymentRequest } from '../models/PaymentRequest.js';
import { Reimbursement } from '../models/Reimbursement.js';
import { Receipt } from '../models/Receipt.js';
import { Transaction } from '../models/Transaction.js';
import { RecurringItem } from '../models/RecurringItem.js';
import { Client } from '../models/Client.js';
import { Payee } from '../models/Payee.js';
import { FundTransfer } from '../models/FundTransfer.js';
import { Shareholder } from '../models/Shareholder.js';
import { ShareBonusUser } from '../models/ShareBonusUser.js';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { USER_PAGE_IDS } from '@hbk/shared';
import { resolvePolicy } from '../access/policy.js';
import { getSettings } from '../models/Settings.js';
import { getConfig } from '../config/env.js';
import { sendEmail } from '../utils/email.js';

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

const inviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'user']),
});

router.post('/', roleGuard('admin'), async (req, res, next) => {
  try {
    const data = inviteSchema.parse(req.body);
    const email = data.email.toLowerCase();
    const existing = await User.findOne({ email });
    if (existing) throw new AppError(409, 'Email already in use');

    const user = await User.create({
      name: data.name.trim(),
      email,
      role: data.role,
      active: true,
    });

    const loginUrl = new URL('/login', getConfig().frontendUrl).toString();
    const sent = await sendEmail({
      to: email,
      subject: 'Sign in to HateBookkeeping',
      html: `<p>You have been invited to HateBookkeeping as ${data.name}.</p><p>Sign in with Authentik using this email address:</p><p><a href="${loginUrl}">${loginUrl}</a></p>`,
    });

    const result = user.toObject();
    delete (result as { passwordHash?: string }).passwordHash;
    res.status(201).json({ user: result, email: sent.status === 'skipped' ? 'skipped' : sent.status === 'failed' ? 'failed' : 'sent' });
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

async function bookkeepingHistory(userId: mongoose.Types.ObjectId): Promise<boolean> {
  const id = userId;
  const counts = await Promise.all([
    Invoice.countDocuments({ createdBy: id }),
    Quotation.countDocuments({ $or: [{ createdBy: id }, { approvedBy: id }, { 'approvals.user': id }] }),
    PaymentRequest.countDocuments({ $or: [{ createdBy: id }, { approvedBy: id }, { 'approvals.user': id }] }),
    Reimbursement.countDocuments({ submittedBy: id }),
    Receipt.countDocuments({ createdBy: id }),
    Transaction.countDocuments({ createdBy: id }),
    RecurringItem.countDocuments({ createdBy: id }),
    Client.countDocuments({ createdBy: id }),
    Payee.countDocuments({ createdBy: id }),
    FundTransfer.countDocuments({ createdBy: id }),
    Shareholder.countDocuments({ user: id }),
    ShareBonusUser.countDocuments({ user: id }),
  ]);
  return counts.some((count) => count > 0);
}

router.delete('/:id', roleGuard('admin'), async (req: AuthRequest, res, next) => {
  try {
    if (req.params.id === req.user!._id.toString()) {
      throw new AppError(400, 'Cannot delete yourself');
    }

    const user = await User.findById(req.params.id);
    if (!user) throw new AppError(404, 'User not found');
    if (await bookkeepingHistory(user._id)) {
      throw new AppError(409, 'This person has bookkeeping history. Deactivate them instead.');
    }

    const settings = await getSettings();
    settings.approverIds = (settings.approverIds || []).filter((approverId) => approverId.toString() !== user._id.toString());
    await settings.save();
    await user.deleteOne();
    res.json({ message: 'User deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
