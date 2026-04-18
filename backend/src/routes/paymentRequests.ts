import { Router } from 'express';
import { z } from 'zod';
import { PaymentRequest } from '../models/PaymentRequest.js';
import { Transaction } from '../models/Transaction.js';
import { getNextSequence } from '../models/Counter.js';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authMiddleware);

const createSchema = z.object({
  type: z.enum(['salary', 'reimbursement', 'vendor_payment', 'other']),
  payee: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().int().positive(),
  attachments: z.array(z.string()).optional().default([]),
});

router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    const requests = await PaymentRequest.find(filter)
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    next(error);
  }
});

// Maker creates payment request
router.post('/', roleGuard('admin', 'maker'), async (req: AuthRequest, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const requestNumber = await getNextSequence('pay');
    const request = await PaymentRequest.create({
      ...data,
      requestNumber,
      createdBy: req.user!._id,
    });
    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const request = await PaymentRequest.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email');
    if (!request) throw new AppError(404, 'Payment request not found');
    res.json(request);
  } catch (error) {
    next(error);
  }
});

// Checker approves
router.patch('/:id/approve', roleGuard('admin', 'checker'), async (req: AuthRequest, res, next) => {
  try {
    const request = await PaymentRequest.findById(req.params.id);
    if (!request) throw new AppError(404, 'Payment request not found');
    if (request.status !== 'pending') {
      throw new AppError(400, 'Can only approve pending requests');
    }

    // Maker-checker separation: approver cannot be the creator
    if (request.createdBy.toString() === req.user!._id.toString()) {
      throw new AppError(403, 'Cannot approve your own payment request');
    }

    request.status = 'approved';
    request.approvedBy = req.user!._id;
    request.approvedAt = new Date();
    await request.save();

    res.json(request);
  } catch (error) {
    next(error);
  }
});

// Checker rejects
router.patch('/:id/reject', roleGuard('admin', 'checker'), async (req: AuthRequest, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    const request = await PaymentRequest.findById(req.params.id);
    if (!request) throw new AppError(404, 'Payment request not found');
    if (request.status !== 'pending') {
      throw new AppError(400, 'Can only reject pending requests');
    }

    if (request.createdBy.toString() === req.user!._id.toString()) {
      throw new AppError(403, 'Cannot reject your own payment request');
    }

    request.status = 'rejected';
    request.approvedBy = req.user!._id;
    request.rejectionReason = reason;
    await request.save();

    res.json(request);
  } catch (error) {
    next(error);
  }
});

// Maker executes (after approval, marks as transferred)
router.patch('/:id/execute', roleGuard('admin', 'maker'), async (req: AuthRequest, res, next) => {
  try {
    const { bankReference } = z.object({
      bankReference: z.string().optional().default(''),
    }).parse(req.body);

    const request = await PaymentRequest.findById(req.params.id);
    if (!request) throw new AppError(404, 'Payment request not found');
    if (request.status !== 'approved') {
      throw new AppError(400, 'Can only execute approved requests');
    }

    request.status = 'executed';
    request.executedAt = new Date();
    request.bankReference = bankReference;
    await request.save();

    // Auto-create expense transaction
    const categoryMap: Record<string, string> = {
      salary: 'salary',
      reimbursement: 'reimbursement',
      vendor_payment: 'other',
      other: 'other',
    };

    await Transaction.create({
      date: new Date(),
      type: 'expense',
      category: categoryMap[request.type] || 'other',
      description: `${request.type}: ${request.payee} — ${request.description}`,
      amount: request.amount,
      paymentRequest: request._id,
      bankReference,
      reconciled: !!bankReference,
      createdBy: req.user!._id,
    });

    res.json(request);
  } catch (error) {
    next(error);
  }
});

export default router;
