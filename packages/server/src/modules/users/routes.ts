import { Router } from 'express';
import {
  APPROVER_ROLES,
  permissionsFor,
  profileUpdateSchema,
  userUpdateSchema,
  type MeDto,
  type UserDto,
} from '@hbk/shared';
import { currentUser, requirePermission } from '../../platform/auth.js';
import { conflict, notFound } from '../../platform/errors.js';
import { objectId, parse, route } from '../../platform/http.js';
import { endAllSessions } from '../auth/tokens.js';
import { approvalPolicy, type ApprovalPolicy } from '../settings/service.js';
import { User, type UserDoc } from './model.js';

export function userDto(user: UserDoc, policy: ApprovalPolicy): UserDto {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
    isApprover: policy.approverIds.includes(String(user._id)),
    bankName: user.bankName,
    bankAccountNumber: user.bankAccountNumber,
    fpsId: user.fpsId,
    lastSignInAt: user.lastSignInAt ? user.lastSignInAt.toISOString() : null,
  };
}

export function meDto(user: UserDoc, policy: ApprovalPolicy): MeDto {
  return { ...userDto(user, policy), permissions: permissionsFor(user.role) };
}

const router = Router();

router.get(
  '/',
  requirePermission('users.manage'),
  route(async (_req, res) => {
    const [users, policy] = await Promise.all([User.find().sort({ name: 1 }), approvalPolicy()]);
    res.json(users.map((user) => userDto(user, policy)));
  }),
);

/** Anyone can keep their own payout details up to date; claims are paid to them. */
router.put(
  '/me',
  route(async (req, res) => {
    const input = parse(profileUpdateSchema, req.body);
    const user = currentUser(req);
    user.set(input);
    await user.save();
    res.json(meDto(user, await approvalPolicy()));
  }),
);

router.put(
  '/:id',
  requirePermission('users.manage'),
  route(async (req, res) => {
    const input = parse(userUpdateSchema, req.body);
    const user = await User.findById(objectId(req.params.id, 'That user'));
    if (!user) throw notFound('That user');
    const policy = await approvalPolicy();

    const losesAdmin = user.role === 'admin' && user.active && (input.role !== 'admin' || !input.active);
    if (losesAdmin) {
      const otherAdmins = await User.countDocuments({ role: 'admin', active: true, _id: { $ne: user._id } });
      if (otherAdmins === 0) {
        throw conflict('This is the only admin. Make someone else an admin first.');
      }
    }

    const staysEligibleApprover = input.active && APPROVER_ROLES.includes(input.role);
    if (policy.approverIds.includes(String(user._id)) && !staysEligibleApprover) {
      throw conflict(`${user.name} is an approver. Remove them from the approvers in Settings first.`);
    }

    user.set(input);
    await user.save();
    if (!user.active) await endAllSessions(String(user._id));
    res.json(userDto(user, policy));
  }),
);

export default router;
