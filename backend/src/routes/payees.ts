import { Router } from 'express';
import { z } from 'zod';
import { Payee } from '../models/Payee.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authMiddleware);

const payeeSchema = z.object({
  name: z.string().min(1),
  bankName: z.string().optional().default(''),
  bankAccountNumber: z.string().optional().default(''),
  bankCode: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

router.get('/', async (_req, res, next) => {
  try {
    const payees = await Payee.find().sort({ name: 1 });
    res.json(payees);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = payeeSchema.parse(req.body);
    const payee = await Payee.create({ ...data, createdBy: req.user!._id });
    res.status(201).json(payee);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const data = payeeSchema.parse(req.body);
    const payee = await Payee.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!payee) throw new AppError(404, 'Payee not found');
    res.json(payee);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const payee = await Payee.findByIdAndDelete(req.params.id);
    if (!payee) throw new AppError(404, 'Payee not found');
    res.json({ message: 'Payee deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
