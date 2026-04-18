import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

router.use(authMiddleware, roleGuard('admin'));

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['admin', 'maker', 'checker']).optional(),
  active: z.boolean().optional(),
});

router.get('/', async (_req, res, next) => {
  try {
    const users = await User.find({}, '-passwordHash').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const user = await User.findByIdAndUpdate(req.params.id, data, {
      new: true,
      select: '-passwordHash',
    });

    if (!user) throw new AppError(404, 'User not found');
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
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
