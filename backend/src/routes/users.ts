import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { User } from '../models/User.js';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

router.use(authMiddleware);

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'user']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  fpsPhone: z.string().optional(),
  signatureUrl: z.string().optional(),
});

// Any authenticated user can list users (needed for recipient picker)
router.get('/', async (_req, res, next) => {
  try {
    const users = await User.find({}, '-passwordHash').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Only admins can modify users
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
    if (data.password) {
      user.passwordHash = await bcrypt.hash(data.password, 12);
    }

    await user.save();
    const result = user.toObject();
    delete (result as any).passwordHash;
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
