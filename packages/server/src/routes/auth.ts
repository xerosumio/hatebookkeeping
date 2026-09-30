import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['admin', 'user']),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email, active: true });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, 'Invalid email or password');
    }

    const token = jwt.sign({ userId: user._id }, env.jwtSecret, { expiresIn: '24h' });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        bankName: user.bankName,
        bankAccountNumber: user.bankAccountNumber,
        fpsPhone: user.fpsPhone,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/register',
  authMiddleware,
  roleGuard('admin'),
  async (req: AuthRequest, res, next) => {
    try {
      const data = registerSchema.parse(req.body);
      const existing = await User.findOne({ email: data.email });

      if (existing) {
        throw new AppError(409, 'Email already registered');
      }

      const passwordHash = await bcrypt.hash(data.password, 12);
      const user = await User.create({
        email: data.email,
        passwordHash,
        name: data.name,
        role: data.role,
        mustChangePassword: true,
      });

      res.status(201).json({
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get('/me', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  res.json({
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    bankName: user.bankName,
    bankAccountNumber: user.bankAccountNumber,
    fpsPhone: user.fpsPhone,
  });
});

router.put('/change-password', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = req.user!;

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppError(400, 'Current password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.mustChangePassword = false;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

// API token management
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

export default router;
