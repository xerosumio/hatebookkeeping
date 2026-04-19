import { Router } from 'express';
import { z } from 'zod';
import { PaymentRequest } from '../models/PaymentRequest.js';
import { Transaction } from '../models/Transaction.js';
import { adjustFundBalance } from '../utils/fundBalance.js';
import { User } from '../models/User.js';
import { Settings } from '../models/Settings.js';
import { getNextSequence } from '../models/Counter.js';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendEmail, buildPaymentRequestEmailHtml, buildStatusChangeEmailHtml, getSubjectForRequest } from '../utils/email.js';
import { env } from '../config/env.js';
import { formatMoney } from '../utils/pdf/formatMoney.js';

const router = Router();
router.use(authMiddleware);

const itemSchema = z.object({
  payee: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().int().positive(),
  category: z.string().min(1),
  recipient: z.string().optional().default(''),
});

const createSchema = z.object({
  entity: z.string().optional(),
  description: z.string().optional().default(''),
  items: z.array(itemSchema).min(1),
  sourceBankAccount: z.string().optional().default(''),
  attachments: z.array(z.string()).optional().default([]),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const { status, entity } = req.query;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (entity) filter.entity = entity;

    const requests = await PaymentRequest.find(filter)
      .populate('entity', 'code name')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name')
      .populate('items.payee', 'name bankName bankAccountNumber')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    next(error);
  }
});

router.post('/', roleGuard('admin', 'user'), async (req: AuthRequest, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);
    const requestNumber = await getNextSequence('pay');
    const request = await PaymentRequest.create({
      ...data,
      totalAmount,
      requestNumber,
      createdBy: req.user!._id,
      activityLog: [{
        action: 'created',
        user: req.user!._id,
        timestamp: new Date(),
      }],
    });
    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const request = await PaymentRequest.findById(req.params.id)
      .populate('entity', 'code name bankAccounts')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('items.payee', 'name bankName bankAccountNumber bankCode')
      .populate('activityLog.user', 'name');
    if (!request) throw new AppError(404, 'Payment request not found');
    res.json(request);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', roleGuard('admin', 'user'), async (req: AuthRequest, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const request = await PaymentRequest.findById(req.params.id);
    if (!request) throw new AppError(404, 'Payment request not found');
    if (request.status === 'executed') {
      throw new AppError(400, 'Cannot edit executed requests');
    }

    const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);
    request.entity = data.entity ? (data.entity as any) : undefined;
    request.description = data.description;
    request.items = data.items as any;
    request.totalAmount = totalAmount;
    request.sourceBankAccount = data.sourceBankAccount;
    request.attachments = data.attachments;

    if (data.status && data.status !== request.status) {
      const oldStatus = request.status;
      request.status = data.status;
      request.activityLog.push({
        action: 'updated',
        user: req.user!._id,
        timestamp: new Date(),
        note: `Status changed from ${oldStatus} to ${data.status}`,
      } as any);
    } else {
      request.activityLog.push({
        action: 'updated',
        user: req.user!._id,
        timestamp: new Date(),
      } as any);
    }

    await request.save();

    res.json(request);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', roleGuard('admin', 'user'), async (req: AuthRequest, res, next) => {
  try {
    const request = await PaymentRequest.findById(req.params.id);
    if (!request) throw new AppError(404, 'Payment request not found');
    if (request.status === 'executed') {
      throw new AppError(400, 'Cannot delete executed requests');
    }
    const isCreator = request.createdBy.toString() === req.user!._id.toString();
    const isAdmin = req.user!.role === 'admin';
    if (request.status !== 'pending' && !isAdmin) {
      throw new AppError(400, 'Only admins can delete non-pending requests');
    }
    if (!isCreator && !isAdmin) {
      throw new AppError(403, 'Only the creator or admin can delete this request');
    }

    await PaymentRequest.findByIdAndDelete(req.params.id);
    res.json({ message: 'Payment request deleted' });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/approve', roleGuard('admin'), async (req: AuthRequest, res, next) => {
  try {
    const request = await PaymentRequest.findById(req.params.id);
    if (!request) throw new AppError(404, 'Payment request not found');
    if (request.status !== 'pending') {
      throw new AppError(400, 'Can only approve pending requests');
    }

    request.status = 'approved';
    request.approvedBy = req.user!._id;
    request.approvedAt = new Date();
    request.activityLog.push({
      action: 'approved',
      user: req.user!._id,
      timestamp: new Date(),
    } as any);
    await request.save();

    // Send approval notification emails
    const settings = await Settings.findOne();
    const companyName = settings?.companyName || 'HateBookkeeping';
    const detailUrl = `${env.frontendUrl}/#/payment-requests/${request._id}`;
    const creator = await User.findById(request.createdBy, 'email name');
    const recipientEmails = [...new Set([
      ...(creator?.email ? [creator.email] : []),
      ...(request.notifiedEmails || []),
    ])];

    if (recipientEmails.length > 0) {
      const html = buildStatusChangeEmailHtml({
        companyName,
        requestNumber: request.requestNumber,
        newStatus: 'approved',
        actorName: req.user!.name,
        detailUrl,
      });
      const primary = recipientEmails[0];
      const cc = recipientEmails.slice(1);
      sendEmail({ to: primary, cc: cc.length > 0 ? cc : undefined, subject: getSubjectForRequest(request.requestNumber, true), html }).catch(() => {});
    }

    res.json(request);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/reject', roleGuard('admin'), async (req: AuthRequest, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    const request = await PaymentRequest.findById(req.params.id);
    if (!request) throw new AppError(404, 'Payment request not found');
    if (request.status !== 'pending') {
      throw new AppError(400, 'Can only reject pending requests');
    }

    request.status = 'rejected';
    request.approvedBy = req.user!._id;
    request.rejectionReason = reason;
    request.activityLog.push({
      action: 'rejected',
      user: req.user!._id,
      timestamp: new Date(),
      note: reason,
    } as any);
    await request.save();

    // Send rejection notification emails
    const settings = await Settings.findOne();
    const companyName = settings?.companyName || 'HateBookkeeping';
    const detailUrl = `${env.frontendUrl}/#/payment-requests/${request._id}`;
    const creator = await User.findById(request.createdBy, 'email name');
    const recipientEmails = [...new Set([
      ...(creator?.email ? [creator.email] : []),
      ...(request.notifiedEmails || []),
    ])];

    if (recipientEmails.length > 0) {
      const html = buildStatusChangeEmailHtml({
        companyName,
        requestNumber: request.requestNumber,
        newStatus: 'rejected',
        actorName: req.user!.name,
        reason,
        detailUrl,
      });
      const primary = recipientEmails[0];
      const cc = recipientEmails.slice(1);
      sendEmail({ to: primary, cc: cc.length > 0 ? cc : undefined, subject: getSubjectForRequest(request.requestNumber, true), html }).catch(() => {});
    }

    res.json(request);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/execute', roleGuard('admin', 'user'), async (req: AuthRequest, res, next) => {
  try {
    const { bankReference } = z.object({
      bankReference: z.string().optional().default(''),
    }).parse(req.body);

    const request = await PaymentRequest.findById(req.params.id)
      .populate('items.payee', 'name');
    if (!request) throw new AppError(404, 'Payment request not found');
    if (request.status !== 'approved') {
      throw new AppError(400, 'Can only execute approved requests');
    }

    request.status = 'executed';
    request.executedAt = new Date();
    request.bankReference = bankReference;
    request.activityLog.push({
      action: 'executed',
      user: req.user!._id,
      timestamp: new Date(),
      note: bankReference || undefined,
    } as any);
    await request.save();

    const categoryMap: Record<string, string> = {
      salary: 'salary',
      reimbursement: 'reimbursement',
      vendor_payment: 'other',
      other: 'other',
    };

    for (const item of request.items) {
      const payeeName = typeof item.payee === 'object' && (item.payee as any).name
        ? (item.payee as any).name
        : 'Unknown';

      const payeeId = typeof item.payee === 'object' && (item.payee as any)._id
        ? (item.payee as any)._id
        : item.payee;

      await Transaction.create({
        date: new Date(),
        type: 'expense',
        category: categoryMap[item.category] || 'other',
        description: item.description,
        amount: item.amount,
        entity: request.entity,
        payee: payeeId,
        paymentRequest: request._id,
        bankAccount: request.sourceBankAccount,
        bankReference,
        reconciled: !!bankReference,
        createdBy: req.user!._id,
      });

      if (request.sourceBankAccount) {
        await adjustFundBalance(request.sourceBankAccount, -item.amount);
      }
    }

    // Send execution notification emails
    const settings = await Settings.findOne();
    const companyName = settings?.companyName || 'HateBookkeeping';
    const detailUrl = `${env.frontendUrl}/#/payment-requests/${request._id}`;
    const creator = await User.findById(request.createdBy, 'email name');
    const recipientEmails = [...new Set([
      ...(creator?.email ? [creator.email] : []),
      ...(request.notifiedEmails || []),
    ])];

    if (recipientEmails.length > 0) {
      const html = buildStatusChangeEmailHtml({
        companyName,
        requestNumber: request.requestNumber,
        newStatus: 'executed',
        actorName: req.user!.name,
        bankReference: bankReference || undefined,
        detailUrl,
      });
      const primary = recipientEmails[0];
      const cc = recipientEmails.slice(1);
      sendEmail({ to: primary, cc: cc.length > 0 ? cc : undefined, subject: getSubjectForRequest(request.requestNumber, true), html }).catch(() => {});
    }

    res.json(request);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/notify', roleGuard('admin', 'user'), async (req: AuthRequest, res, next) => {
  try {
    const { emails } = z.object({ emails: z.array(z.string().email()).min(1) }).parse(req.body);
    const request = await PaymentRequest.findById(req.params.id)
      .populate('items.payee', 'name');
    if (!request) throw new AppError(404, 'Payment request not found');
    if (request.status !== 'pending') {
      throw new AppError(400, 'Can only send notifications for pending requests');
    }

    const settings = await Settings.findOne();
    const companyName = settings?.companyName || 'HateBookkeeping';
    const detailUrl = `${env.frontendUrl}/#/payment-requests/${request._id}`;

    const items = request.items.map((item) => {
      const payeeName = typeof item.payee === 'object' && (item.payee as any).name
        ? (item.payee as any).name : 'Unknown';
      return {
        payeeName,
        description: item.description,
        category: item.category,
        amount: formatMoney(item.amount),
      };
    });

    const html = buildPaymentRequestEmailHtml({
      companyName,
      requestNumber: request.requestNumber,
      description: request.description,
      requesterName: req.user!.name,
      createdAt: new Date(request.createdAt).toLocaleDateString(),
      sourceBankAccount: request.sourceBankAccount,
      items,
      totalAmount: formatMoney(request.totalAmount),
      detailUrl,
      actionLabel: 'Pending Approval:',
      actionMessage: `${req.user!.name} has submitted a payment request and is requesting your review.`,
    });

    const primaryRecipient = emails[0];
    const ccRecipients = emails.slice(1);

    await sendEmail({
      to: primaryRecipient,
      cc: ccRecipients.length > 0 ? ccRecipients : undefined,
      subject: getSubjectForRequest(request.requestNumber, false),
      html,
    });

    const merged = [...new Set([...(request.notifiedEmails || []), ...emails])];
    request.notifiedEmails = merged;
    request.activityLog.push({
      action: 'notified',
      user: req.user!._id,
      timestamp: new Date(),
      note: `Sent to: ${emails.join(', ')}`,
    } as any);
    await request.save();

    res.json({ message: 'Notification sent', notifiedEmails: merged });
  } catch (error) {
    next(error);
  }
});

export default router;
