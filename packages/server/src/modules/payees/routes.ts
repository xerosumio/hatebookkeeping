import { Router } from 'express';
import { Schema, model, type HydratedDocument } from 'mongoose';
import { payeeInputSchema, type PayeeDto } from '@hbk/shared';
import { requirePermission } from '../../platform/auth.js';
import { notFound, validationError } from '../../platform/errors.js';
import { objectId, parse, route } from '../../platform/http.js';
import { assertUnused } from '../../platform/references.js';

export interface PayeeAttrs {
  name: string;
  bankName: string;
  bankAccountNumber: string;
  bankCode: string;
  fpsId: string;
  notes: string;
  archived: boolean;
}

const payeeSchema = new Schema<PayeeAttrs>(
  {
    name: { type: String, required: true, trim: true },
    bankName: { type: String, default: '' },
    bankAccountNumber: { type: String, default: '' },
    bankCode: { type: String, default: '' },
    fpsId: { type: String, default: '' },
    notes: { type: String, default: '' },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true, optimisticConcurrency: true },
);

export const Payee = model<PayeeAttrs>('Payee', payeeSchema);
export type PayeeDoc = HydratedDocument<PayeeAttrs>;

export function payeeDto(payee: PayeeDoc): PayeeDto {
  return {
    id: String(payee._id),
    name: payee.name,
    bankName: payee.bankName,
    bankAccountNumber: payee.bankAccountNumber,
    bankCode: payee.bankCode,
    fpsId: payee.fpsId,
    notes: payee.notes,
    archived: payee.archived,
  };
}

/** The payee on a new expense: it must exist and not be archived (unless already on the record). */
export async function payeeForInput(payeeId: string, current?: unknown): Promise<PayeeDoc> {
  const payee = await Payee.findById(payeeId);
  if (!payee) throw validationError({ payeeId: 'Choose a payee' });
  if (payee.archived && String(current ?? '') !== payeeId) {
    throw validationError({ payeeId: `${payee.name} is archived. Restore it or choose another payee` });
  }
  return payee;
}

const router = Router();

async function load(id: unknown): Promise<PayeeDoc> {
  const payee = await Payee.findById(objectId(id, 'That payee'));
  if (!payee) throw notFound('That payee');
  return payee;
}

/** Payees carry bank details, so the list is for the office only. */
router.get(
  '/',
  requirePermission('payees.view'),
  route(async (_req, res) => {
    const payees = await Payee.find().sort({ archived: 1, name: 1 });
    res.json(payees.map(payeeDto));
  }),
);

router.post(
  '/',
  requirePermission('payees.manage'),
  route(async (req, res) => {
    const payee = await Payee.create(parse(payeeInputSchema, req.body));
    res.status(201).json(payeeDto(payee));
  }),
);

router.put(
  '/:id',
  requirePermission('payees.manage'),
  route(async (req, res) => {
    const input = parse(payeeInputSchema, req.body);
    const payee = await load(req.params.id);
    payee.set(input);
    await payee.save();
    res.json(payeeDto(payee));
  }),
);

for (const [action, archived] of [
  ['archive', true],
  ['restore', false],
] as const) {
  router.post(
    `/:id/${action}`,
    requirePermission('payees.manage'),
    route(async (req, res) => {
      const payee = await load(req.params.id);
      payee.archived = archived;
      await payee.save();
      res.json(payeeDto(payee));
    }),
  );
}

router.delete(
  '/:id',
  requirePermission('payees.manage'),
  route(async (req, res) => {
    const payee = await load(req.params.id);
    await assertUnused('payee', String(payee._id), payee.name);
    await payee.deleteOne();
    res.status(204).end();
  }),
);

export default router;
