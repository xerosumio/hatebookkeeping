import { Router } from 'express';
import { z } from 'zod';
import { Reimbursement } from '../models/Reimbursement.js';
import { PaymentRequest } from '../models/PaymentRequest.js';
import { User } from '../models/User.js';
import { Payee } from '../models/Payee.js';
import { getNextSequence } from '../models/Counter.js';
import { getSettings } from '../models/Settings.js';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendEmail, buildPaymentRequestEmailHtml, getSubjectForRequest } from '../utils/email.js';
import { env } from '../config/env.js';
import { formatMoney } from '../utils/pdf/formatMoney.js';

const router = Router();
router.use(authMiddleware);

const itemSchema = z.object({
  date: z.string(),
  description: z.string().min(1),
  amount: z.number().int().positive(),
  category: z.string().min(1),
  receiptUrl: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

const createSchema = z.object({
  title: z.string().min(1),
  entity: z.string().optional(),
  onBehalfOfUserId: z.string().optional(),
  items: z.array(itemSchema).min(1),
  notes: z.string().optional().default(''),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  entity: z.string().optional(),
  items: z.array(itemSchema).min(1).optional(),
  notes: z.string().optional(),
});

async function findOrCreatePayeeForUser(targetUser: { _id: any; name: string; bankName: string; bankAccountNumber: string }): Promise<string> {
  let payee = await Payee.findOne({
    name: targetUser.name,
    bankAccountNumber: targetUser.bankAccountNumber || undefined,
  });
  if (!payee) {
    payee = await Payee.create({
      name: targetUser.name,
      bankName: targetUser.bankName || '',
      bankAccountNumber: targetUser.bankAccountNumber || '',
      createdBy: targetUser._id,
    });
  } else if (payee.bankName !== targetUser.bankName) {
    payee.bankName = targetUser.bankName || '';
    await payee.save();
  }
  return payee._id.toString();
}

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.user!.role !== 'admin') {
      filter.submittedBy = req.user!._id;
    }
    const reimbursements = await Reimbursement.find(filter)
      .populate('entity', 'code name')
      .populate('submittedBy', 'name email bankName bankAccountNumber fpsPhone')
      .populate('paymentRequest', 'requestNumber status')
      .sort({ createdAt: -1 });
    res.json(reimbursements);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const reimbursement = await Reimbursement.findById(req.params.id)
      .populate('entity', 'code name')
      .populate('submittedBy', 'name email bankName bankAccountNumber fpsPhone')
      .populate({
        path: 'paymentRequest',
        populate: [
          { path: 'createdBy', select: 'name' },
          { path: 'approvedBy', select: 'name' },
        ],
      });
    if (!reimbursement) throw new AppError(404, 'Reimbursement not found');
    res.json(reimbursement);
  } catch (error) {
    next(error);
  }
});

router.post('/', roleGuard('admin', 'user'), async (req: AuthRequest, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);

    let targetUserId = req.user!._id;
    if (data.onBehalfOfUserId && req.user!.role === 'admin') {
      targetUserId = data.onBehalfOfUserId as any;
    }

    const targetUser = await User.findById(targetUserId).select('name bankName bankAccountNumber');
    if (!targetUser) throw new AppError(404, 'Target user not found');

    const payeeId = await findOrCreatePayeeForUser(targetUser);

    const reimbursementNumber = await getNextSequence('rb');
    const payRequestNumber = await getNextSequence('pay');

    const paymentRequest = await PaymentRequest.create({
      requestNumber: payRequestNumber,
      entity: data.entity || undefined,
      description: `Reimbursement ${reimbursementNumber}: ${data.title}`,
      items: data.items.map((item) => ({
        payee: payeeId,
        description: item.description,
        amount: item.amount,
        category: item.category,
        recipient: '',
      })),
      totalAmount,
      sourceBankAccount: '',
      status: 'pending',
      createdBy: req.user!._id,
      activityLog: [{
        action: 'created',
        user: req.user!._id,
        timestamp: new Date(),
        note: `Auto-created from reimbursement ${reimbursementNumber}`,
      }],
    });

    const reimbursement = await Reimbursement.create({
      reimbursementNumber,
      entity: data.entity || undefined,
      title: data.title,
      submittedBy: targetUserId,
      items: data.items.map((item) => ({
        ...item,
        date: new Date(item.date),
      })),
      totalAmount,
      paymentRequest: paymentRequest._id,
      notes: data.notes,
    });

    const admins = await User.find({ role: 'admin', active: true }).select('email name');
    const adminEmails = admins.map((a) => a.email).filter(Boolean);

    if (adminEmails.length > 0) {
      const settings = await getSettings();
      const companyName = settings.companyName || 'HateBookkeeping';
      const detailUrl = `${env.frontendUrl}/#/payment-requests/${paymentRequest._id}`;
      const prWithPayee = await PaymentRequest.findById(paymentRequest._id).populate('items.payee', 'name');
      const emailItems = (prWithPayee?.items || paymentRequest.items).map((item: any) => ({
        payeeName: typeof item.payee === 'object' && item.payee?.name ? item.payee.name : 'Unknown',
        description: item.description,
        category: item.category,
        amount: formatMoney(item.amount),
      }));

      const html = buildPaymentRequestEmailHtml({
        companyName,
        requestNumber: paymentRequest.requestNumber,
        description: paymentRequest.description,
        requesterName: req.user!.name,
        createdAt: new Date().toLocaleDateString(),
        sourceBankAccount: '',
        items: emailItems,
        totalAmount: formatMoney(totalAmount),
        detailUrl,
        actionLabel: 'Reimbursement Pending Approval:',
        actionMessage: `${req.user!.name} has submitted a reimbursement claim "${data.title}" for ${targetUser.name} and is requesting your approval.`,
      });

      const primary = adminEmails[0];
      const cc = adminEmails.slice(1);
      sendEmail({
        to: primary,
        cc: cc.length > 0 ? cc : undefined,
        subject: getSubjectForRequest(paymentRequest.requestNumber, false),
        html,
      }).catch(() => {});

      paymentRequest.notifiedEmails = adminEmails;
      paymentRequest.activityLog.push({
        action: 'notified',
        user: req.user!._id,
        timestamp: new Date(),
        note: `Auto-notified admins: ${adminEmails.join(', ')}`,
      } as any);
      await paymentRequest.save();
    }

    const populated = await Reimbursement.findById(reimbursement._id)
      .populate('entity', 'code name')
      .populate('submittedBy', 'name email bankName bankAccountNumber fpsPhone')
      .populate('paymentRequest', 'requestNumber status');

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', roleGuard('admin', 'user'), async (req: AuthRequest, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const reimbursement = await Reimbursement.findById(req.params.id).populate('paymentRequest');
    if (!reimbursement) throw new AppError(404, 'Reimbursement not found');

    const pr = reimbursement.paymentRequest as any;
    if (pr && pr.status !== 'pending') {
      throw new AppError(400, 'Cannot edit reimbursement — payment request is no longer pending');
    }

    if (data.title) reimbursement.title = data.title;
    if (data.entity !== undefined) reimbursement.entity = data.entity as any;
    if (data.notes !== undefined) reimbursement.notes = data.notes;
    if (data.items) {
      reimbursement.items = data.items.map((item) => ({
        ...item,
        date: new Date(item.date),
      })) as any;
      reimbursement.totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);
    }
    await reimbursement.save();

    if (pr) {
      const targetUser = await User.findById(reimbursement.submittedBy).select('name bankName bankAccountNumber');
      const payeeId = targetUser ? await findOrCreatePayeeForUser(targetUser) : undefined;

      if (data.items && payeeId) {
        pr.items = data.items.map((item) => ({
          payee: payeeId,
          description: item.description,
          amount: item.amount,
          category: item.category,
          recipient: '',
        }));
        pr.totalAmount = reimbursement.totalAmount;
      }
      if (data.title) {
        pr.description = `Reimbursement ${reimbursement.reimbursementNumber}: ${data.title}`;
      }
      if (data.entity !== undefined) {
        pr.entity = data.entity || undefined;
      }
      pr.activityLog.push({
        action: 'updated',
        user: req.user!._id,
        timestamp: new Date(),
        note: 'Updated via reimbursement edit',
      });
      await pr.save();
    }

    const populated = await Reimbursement.findById(reimbursement._id)
      .populate('entity', 'code name')
      .populate('submittedBy', 'name email bankName bankAccountNumber fpsPhone')
      .populate('paymentRequest', 'requestNumber status');

    res.json(populated);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', roleGuard('admin', 'user'), async (req: AuthRequest, res, next) => {
  try {
    const reimbursement = await Reimbursement.findById(req.params.id).populate('paymentRequest');
    if (!reimbursement) throw new AppError(404, 'Reimbursement not found');

    const pr = reimbursement.paymentRequest as any;
    if (pr && pr.status !== 'pending') {
      throw new AppError(400, 'Cannot delete reimbursement — payment request is no longer pending');
    }

    if (pr) {
      await PaymentRequest.findByIdAndDelete(pr._id);
    }
    await Reimbursement.findByIdAndDelete(reimbursement._id);

    res.json({ message: 'Reimbursement deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
