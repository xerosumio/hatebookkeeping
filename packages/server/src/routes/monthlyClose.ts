import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { requirePage } from '../access/policy.js';
import { AppError } from '../middleware/errorHandler.js';
import { closeMonth, findClose, previewClose, reopenMonth } from '../services/monthlyClose.js';

const router = Router();
router.use(authMiddleware);
router.use(requirePage('reports'));

function requireAdmin(req: AuthRequest) {
  if (req.user!.role !== 'admin') throw new AppError(403, 'Admin only');
}

const periodSchema = z.object({
  entity: z.string().refine((value) => mongoose.isValidObjectId(value), 'Choose an entity'),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

router.get('/', async (req, res, next) => {
  try {
    const { entity, year, month } = periodSchema.parse(req.query);
    res.json(await findClose(entity, year, month));
  } catch (error) {
    next(error);
  }
});

router.get('/preview', async (req, res, next) => {
  try {
    const { entity, year, month } = periodSchema.parse(req.query);
    res.json(await previewClose(entity, year, month));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    requireAdmin(req);
    const data = periodSchema.extend({
      reserveHeldIn: z.string().optional().default(''),
      sourceBankAccount: z.string().optional().default(''),
      notes: z.string().optional().default(''),
    }).parse(req.body);
    const close = await closeMonth({
      entityId: data.entity,
      year: data.year,
      month: data.month,
      reserveHeldIn: data.reserveHeldIn,
      sourceBankAccount: data.sourceBankAccount,
      notes: data.notes,
      userId: req.user!._id,
    });
    res.status(201).json(await findClose(data.entity, close.year, close.month));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/reopen', async (req: AuthRequest, res, next) => {
  try {
    requireAdmin(req);
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) throw new AppError(404, 'Monthly close not found');
    await reopenMonth(id);
    res.json({ message: 'Month reopened' });
  } catch (error) {
    next(error);
  }
});

export default router;
