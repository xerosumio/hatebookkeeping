import { Router } from 'express';
import { z } from 'zod';
import { Settings, getSettings } from '../models/Settings.js';
import { authMiddleware, roleGuard } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const updateSchema = z.object({
  companyName: z.string().min(1).optional(),
  companyAddress: z.string().optional(),
  companyPhone: z.string().optional(),
  companyEmail: z.string().optional(),
  companyWebsite: z.string().optional(),
  logoUrl: z.string().optional(),
  bankAccountInfo: z.string().optional(),
  bankAccounts: z.array(z.object({
    name: z.string().min(1),
    bankName: z.string().optional().default(''),
    accountNumber: z.string().optional().default(''),
    bankCode: z.string().optional().default(''),
    branchCode: z.string().optional().default(''),
    swiftCode: z.string().optional().default(''),
    location: z.string().optional().default(''),
  })).optional(),
  chartOfAccounts: z.array(z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['income', 'expense']),
    active: z.boolean().optional().default(true),
  })).optional(),
  companyChopUrl: z.string().optional(),
  signatureUrl: z.string().optional(),
  recurringAlertMethod: z.enum(['email', 'in_app', 'both']).optional(),
});

router.get('/', async (_req, res, next) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

router.put('/', roleGuard('admin'), async (_req, res, next) => {
  try {
    const data = updateSchema.parse(_req.body);
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create(data);
    } else {
      Object.assign(settings, data);
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

export default router;
