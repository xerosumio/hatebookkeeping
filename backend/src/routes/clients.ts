import { Router } from 'express';
import { z } from 'zod';
import { Client } from '../models/Client.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authMiddleware);

const clientSchema = z.object({
  name: z.string().min(1),
  entity: z.string().optional(),
  contactPerson: z.string().optional().default(''),
  email: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  address: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

router.get('/', async (req, res, next) => {
  try {
    const { search, entity } = req.query;
    const filter: Record<string, unknown> = {};
    if (search) filter.$text = { $search: search as string };
    if (entity) filter.entity = entity;
    const clients = await Client.find(filter).populate('entity', 'code name').sort({ createdAt: -1 });
    res.json(clients);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = clientSchema.parse(req.body);
    const client = await Client.create({ ...data, createdBy: req.user!._id });
    res.status(201).json(client);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id).populate('entity', 'code name');
    if (!client) throw new AppError(404, 'Client not found');
    res.json(client);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const data = clientSchema.parse(req.body);
    const client = await Client.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!client) throw new AppError(404, 'Client not found');
    res.json(client);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) throw new AppError(404, 'Client not found');
    res.json({ message: 'Client deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
