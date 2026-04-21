import { Router } from 'express';
import { z } from 'zod';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { Quotation } from '../models/Quotation.js';
import { Entity } from '../models/Entity.js';
import { User } from '../models/User.js';
import { getNextSequence } from '../models/Counter.js';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { QuotationPDF } from '../utils/pdf/QuotationPDF.js';
import { getSettings, Settings } from '../models/Settings.js';
import { env } from '../config/env.js';
import { sendEmail, buildStatusChangeEmailHtml } from '../utils/email.js';
import { resolveImageFields } from '../utils/resolveImageForPdf.js';

const router = Router();
router.use(authMiddleware);

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().int(),
  amount: z.number().int(),
  waived: z.boolean().optional().default(false),
});

const milestoneSchema = z.object({
  milestone: z.string().min(1),
  percentage: z.number().min(0).max(100),
  amount: z.number().int(),
  dueDescription: z.string().optional().default(''),
});

const quotationSchema = z.object({
  entity: z.string().min(1),
  client: z.string().min(1),
  title: z.string().min(1),
  lineItems: z.array(lineItemSchema).min(1),
  subtotal: z.number().int(),
  discount: z.number().int().optional().default(0),
  discountPercent: z.number().min(0).max(100).optional().default(0),
  total: z.number().int(),
  termsAndConditions: z.string().optional().default(''),
  paymentSchedule: z.array(milestoneSchema).optional().default([]),
  companyChopUrl: z.string().optional().default(''),
  signatureUrl: z.string().optional().default(''),
  validUntil: z.string().optional(),
  notes: z.string().optional().default(''),
});

const statusSchema = z.object({
  status: z.enum(['pending_approval', 'sent', 'accepted', 'rejected']),
});

router.get('/', async (req, res, next) => {
  try {
    const { status, client, entity } = req.query;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (client) filter.client = client;
    if (entity) filter.entity = entity;

    const quotations = await Quotation.find(filter)
      .populate('client', 'name')
      .populate('entity', 'code name')
      .sort({ createdAt: -1 });
    res.json(quotations);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = quotationSchema.parse(req.body);
    const entity = await Entity.findById(data.entity);
    if (!entity) throw new AppError(400, 'Entity not found');
    const quotationNumber = await getNextSequence('quo', entity.code);
    const quotation = await Quotation.create({
      ...data,
      quotationNumber,
      createdBy: req.user!._id,
      activityLog: [{
        action: 'created',
        user: req.user!._id,
        timestamp: new Date(),
      }],
    });
    res.status(201).json(quotation);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('client')
      .populate('entity')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('activityLog.user', 'name');
    if (!quotation) throw new AppError(404, 'Quotation not found');
    res.json(quotation);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await Quotation.findById(req.params.id);
    if (!existing) throw new AppError(404, 'Quotation not found');
    if (existing.status !== 'draft') {
      throw new AppError(400, 'Can only edit draft quotations');
    }

    const data = quotationSchema.parse(req.body);
    const quotation = await Quotation.findByIdAndUpdate(
      req.params.id,
      {
        ...data,
        $push: { activityLog: { action: 'updated', user: (req as AuthRequest).user!._id, timestamp: new Date() } },
      },
      { new: true },
    );
    res.json(quotation);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = statusSchema.parse(req.body);
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) throw new AppError(404, 'Quotation not found');

    const validTransitions: Record<string, string[]> = {
      draft: ['pending_approval', 'sent'],
      pending_approval: ['sent'],
      approved: ['sent'],
      sent: ['accepted', 'rejected'],
    };

    const allowed = validTransitions[quotation.status] || [];
    if (!allowed.includes(status)) {
      throw new AppError(400, `Cannot transition from ${quotation.status} to ${status}`);
    }

    quotation.status = status as any;
    quotation.activityLog.push({
      action: status as any,
      user: (req as AuthRequest).user!._id,
      timestamp: new Date(),
    } as any);
    await quotation.save();
    res.json(quotation);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/approve', roleGuard('admin'), async (req: AuthRequest, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) throw new AppError(404, 'Quotation not found');
    if (quotation.status !== 'pending_approval') {
      throw new AppError(400, 'Can only approve quotations pending approval');
    }

    quotation.status = 'approved';
    quotation.approvedBy = req.user!._id;
    quotation.approvedAt = new Date();
    quotation.activityLog.push({
      action: 'approved',
      user: req.user!._id,
      timestamp: new Date(),
    } as any);
    await quotation.save();

    const settings = await Settings.findOne();
    const companyName = settings?.companyName || 'HateBookkeeping';
    const detailUrl = `${env.frontendUrl}/#/quotations/${quotation._id}`;
    const creator = await User.findById(quotation.createdBy, 'email name');
    const recipientEmails = [...new Set([
      ...(creator?.email ? [creator.email] : []),
      ...(quotation.notifiedEmails || []),
    ])];

    if (recipientEmails.length > 0) {
      const html = buildStatusChangeEmailHtml({
        companyName,
        requestNumber: quotation.quotationNumber,
        requestLabel: 'Quotation',
        newStatus: 'approved',
        actorName: req.user!.name,
        detailUrl,
      });
      const primary = recipientEmails[0];
      const cc = recipientEmails.slice(1);
      sendEmail({ to: primary, cc: cc.length > 0 ? cc : undefined, subject: `Quotation ${quotation.quotationNumber} Approved`, html }).catch(() => {});
    }

    res.json(quotation);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/reject', roleGuard('admin'), async (req: AuthRequest, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().optional().default('') }).parse(req.body);
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) throw new AppError(404, 'Quotation not found');
    if (quotation.status !== 'pending_approval') {
      throw new AppError(400, 'Can only reject quotations pending approval');
    }

    quotation.status = 'draft';
    quotation.rejectionReason = reason;
    quotation.activityLog.push({
      action: 'rejected',
      user: req.user!._id,
      timestamp: new Date(),
      note: reason || undefined,
    } as any);
    await quotation.save();

    const settings = await Settings.findOne();
    const companyName = settings?.companyName || 'HateBookkeeping';
    const detailUrl = `${env.frontendUrl}/#/quotations/${quotation._id}`;
    const creator = await User.findById(quotation.createdBy, 'email name');
    const recipientEmails = [...new Set([
      ...(creator?.email ? [creator.email] : []),
      ...(quotation.notifiedEmails || []),
    ])];

    if (recipientEmails.length > 0) {
      const html = buildStatusChangeEmailHtml({
        companyName,
        requestNumber: quotation.quotationNumber,
        requestLabel: 'Quotation',
        newStatus: 'rejected',
        actorName: req.user!.name,
        reason: reason || undefined,
        detailUrl,
      });
      const primary = recipientEmails[0];
      const cc = recipientEmails.slice(1);
      sendEmail({ to: primary, cc: cc.length > 0 ? cc : undefined, subject: `Quotation ${quotation.quotationNumber} Returned`, html }).catch(() => {});
    }

    res.json(quotation);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/notify', roleGuard('admin', 'user'), async (req: AuthRequest, res, next) => {
  try {
    const { emails } = z.object({ emails: z.array(z.string().email()).min(1) }).parse(req.body);
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) throw new AppError(404, 'Quotation not found');
    if (quotation.status !== 'pending_approval') {
      throw new AppError(400, 'Can only send notifications for quotations pending approval');
    }

    const settings = await Settings.findOne();
    const companyName = settings?.companyName || 'HateBookkeeping';
    const detailUrl = `${env.frontendUrl}/#/quotations/${quotation._id}`;

    const html = buildStatusChangeEmailHtml({
      companyName,
      requestNumber: quotation.quotationNumber,
      requestLabel: 'Quotation',
      newStatus: 'pending',
      actorName: req.user!.name,
      detailUrl,
    });

    const primaryRecipient = emails[0];
    const ccRecipients = emails.slice(1);
    await sendEmail({
      to: primaryRecipient,
      cc: ccRecipients.length > 0 ? ccRecipients : undefined,
      subject: `Quotation ${quotation.quotationNumber} — Approval Requested`,
      html,
    });

    const merged = [...new Set([...(quotation.notifiedEmails || []), ...emails])];
    quotation.notifiedEmails = merged;
    quotation.activityLog.push({
      action: 'notified',
      user: req.user!._id,
      timestamp: new Date(),
      note: `Sent to: ${emails.join(', ')}`,
    } as any);
    await quotation.save();

    res.json({ message: 'Notification sent', notifiedEmails: merged });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/pdf', async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id).populate('client').populate('entity');
    if (!quotation) throw new AppError(404, 'Quotation not found');

    const entityObj = (quotation as any).entity;
    const settings = await getSettings();
    const company = entityObj
      ? { companyName: entityObj.name, companyAddress: entityObj.address, companyPhone: entityObj.phone, companyEmail: entityObj.email, companyWebsite: entityObj.website, logoUrl: entityObj.logoUrl, brandColor: entityObj.brandColor, companyChopUrl: entityObj.companyChopUrl, signatureUrl: entityObj.signatureUrl, bankAccounts: entityObj.bankAccounts }
      : { ...settings.toObject() } as any;
    await resolveImageFields(company, ['logoUrl', 'companyChopUrl', 'signatureUrl']);
    const q = quotation as any;
    await resolveImageFields(q, ['companyChopUrl', 'signatureUrl']);
    if (!q.companyChopUrl && company.companyChopUrl) q.companyChopUrl = company.companyChopUrl;
    if (!q.signatureUrl && company.signatureUrl) q.signatureUrl = company.signatureUrl;
    const buffer = await renderToBuffer(
      React.createElement(QuotationPDF, { quotation: q, company }) as any,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quotation.quotationNumber}.pdf"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
});

export default router;
