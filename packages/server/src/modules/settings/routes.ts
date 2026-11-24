import { Router } from 'express';
import {
  APPROVER_ROLES,
  approvalSettingsSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  type ApprovalSettingsDto,
} from '@hbk/shared';
import { requirePermission } from '../../platform/auth.js';
import { conflict, notFound, validationError } from '../../platform/errors.js';
import { parse, route } from '../../platform/http.js';
import { User } from '../users/model.js';
import type { SettingsDoc } from './model.js';
import { categoryDto, getSettings } from './service.js';

const router = Router();

// ── Categories ──────────────────────────────────────────────────────────────

/** Everyone needs the list: staff choose an expense category on each claim line. */
router.get(
  '/categories',
  route(async (_req, res) => {
    const settings = await getSettings();
    res.json(settings.categories.map(categoryDto));
  }),
);

function assertNameFree(settings: SettingsDoc, name: string, type: string, exceptId?: string): void {
  const clash = settings.categories.some(
    (category) =>
      category.type === type && category.name.toLowerCase() === name.toLowerCase() && String(category._id) !== exceptId,
  );
  if (clash) throw validationError({ name: `There is already ${type === 'income' ? 'an income' : 'an expense'} category called "${name}"` });
}

router.post(
  '/categories',
  requirePermission('settings.manage'),
  route(async (req, res) => {
    const input = parse(categoryCreateSchema, req.body);
    const settings = await getSettings();
    assertNameFree(settings, input.name, input.type);
    settings.categories.push({ name: input.name, type: input.type, active: true, system: null });
    await settings.save();
    res.status(201).json(categoryDto(settings.categories[settings.categories.length - 1]!));
  }),
);

/**
 * Categories are renamed or switched off, never deleted: records already
 * filed under one keep showing its name, and old months keep their totals.
 */
router.put(
  '/categories/:id',
  requirePermission('settings.manage'),
  route(async (req, res) => {
    const input = parse(categoryUpdateSchema, req.body);
    const settings = await getSettings();
    const category = settings.categories.find((candidate) => String(candidate._id) === req.params.id);
    if (!category) throw notFound('That category');
    if (category.system && !input.active) {
      throw conflict(`"${category.name}" is used by the app itself and cannot be switched off. You can rename it.`);
    }
    assertNameFree(settings, input.name, category.type, String(category._id));
    category.name = input.name;
    category.active = input.active;
    await settings.save();
    res.json(categoryDto(category));
  }),
);

// ── Approvers ───────────────────────────────────────────────────────────────

const approvalDto = (settings: SettingsDoc): ApprovalSettingsDto => ({
  approverIds: settings.approverIds.map(String),
  approvalsRequired: settings.approvalsRequired,
});

router.get(
  '/approval',
  requirePermission('settings.manage'),
  route(async (_req, res) => {
    res.json(approvalDto(await getSettings()));
  }),
);

router.put(
  '/approval',
  requirePermission('settings.manage'),
  route(async (req, res) => {
    const input = parse(approvalSettingsSchema, req.body);
    const ids = [...new Set(input.approverIds)];
    const users = await User.find({ _id: { $in: ids } }).select('name role active');
    const fields: Record<string, string> = {};
    ids.forEach((id, index) => {
      const user = users.find((candidate) => String(candidate._id) === id);
      if (!user) fields[`approverIds.${index}`] = 'That person no longer exists';
      else if (!user.active) fields[`approverIds.${index}`] = `${user.name} cannot sign in, so cannot approve`;
      else if (!APPROVER_ROLES.includes(user.role)) fields[`approverIds.${index}`] = `${user.name} must be an admin or bookkeeper to approve`;
    });
    if (Object.keys(fields).length > 0) throw validationError(fields);
    if (input.approvalsRequired > ids.length && ids.length > 0) {
      throw validationError({ approvalsRequired: `Only ${ids.length} approver${ids.length === 1 ? ' is' : 's are'} chosen` });
    }

    const settings = await getSettings();
    settings.set({ approverIds: ids, approvalsRequired: input.approvalsRequired });
    await settings.save();
    res.json(approvalDto(settings));
  }),
);

export default router;
