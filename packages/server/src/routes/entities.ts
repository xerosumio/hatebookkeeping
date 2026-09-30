import { Router } from 'express';
import { z } from 'zod';
import { Entity } from '../models/Entity.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authMiddleware);

const entitySchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1),
  address: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  email: z.string().optional().default(''),
  website: z.string().optional().default(''),
  logoUrl: z.string().optional().default(''),
  bankAccounts: z.array(z.object({
    name: z.string().min(1),
    bankName: z.string().optional().default(''),
    accountNumber: z.string().optional().default(''),
    bankCode: z.string().optional().default(''),
    branchCode: z.string().optional().default(''),
    swiftCode: z.string().optional().default(''),
    location: z.string().optional().default(''),
  })).optional().default([]),
  defaultBankAccountIndex: z.number().int().min(0).optional().default(0),
  brandColor: z.string().optional().default(''),
  companyChopUrl: z.string().optional().default(''),
  signatureUrl: z.string().optional().default(''),
  active: z.boolean().optional().default(true),
});

router.get('/', async (_req, res, next) => {
  try {
    const entities = await Entity.find().sort({ code: 1 });
    res.json(entities);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const entity = await Entity.findById(req.params.id);
    if (!entity) throw new AppError(404, 'Entity not found');
    res.json(entity);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role !== 'admin') throw new AppError(403, 'Admin only');
    const data = entitySchema.parse(req.body);
    const entity = await Entity.create(data);
    res.status(201).json(entity);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role !== 'admin') throw new AppError(403, 'Admin only');
    const data = entitySchema.partial().parse(req.body);
    const entity = await Entity.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!entity) throw new AppError(404, 'Entity not found');
    res.json(entity);
  } catch (error) {
    next(error);
  }
});

export default router;
