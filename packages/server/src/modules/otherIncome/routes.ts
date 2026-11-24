import { Router } from 'express';
import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { hkToday, otherIncomeInputSchema, type OtherIncomeDto, type OtherIncomeInput } from '@hbk/shared';
import { currentUser, requirePermission } from '../../platform/auth.js';
import { notFound, validationError } from '../../platform/errors.js';
import { objectId, parse, queryString, route } from '../../platform/http.js';
import { refOf } from '../../platform/references.js';
import { companyForInput, companyNames } from '../companies/service.js';
import { assertCategories, categoryName, loadCategories } from '../settings/service.js';

/**
 * Money received that is not from an invoice: bank interest, a grant, a
 * refund. It counts in the P&L on the day it was received, on both bases.
 */
export interface OtherIncomeAttrs {
  companyId: Types.ObjectId;
  date: string;
  description: string;
  categoryId: Types.ObjectId;
  amount: number;
  notes: string;
  createdById: Types.ObjectId;
  createdByName: string;
}

const otherIncomeSchema = new Schema<OtherIncomeAttrs>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    date: { type: String, required: true, index: true },
    description: { type: String, required: true },
    categoryId: { type: Schema.Types.ObjectId, required: true },
    amount: { type: Number, required: true },
    notes: { type: String, default: '' },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true, optimisticConcurrency: true },
);

export const OtherIncome = model<OtherIncomeAttrs>('OtherIncome', otherIncomeSchema);
export type OtherIncomeDoc = HydratedDocument<OtherIncomeAttrs>;

async function dtos(entries: OtherIncomeDoc[]): Promise<OtherIncomeDto[]> {
  const [companies, categories] = await Promise.all([companyNames(), loadCategories()]);
  return entries.map((entry) => ({
    id: String(entry._id),
    company: refOf(companies, entry.companyId),
    date: entry.date,
    description: entry.description,
    categoryId: String(entry.categoryId),
    categoryName: categoryName(categories, entry.categoryId),
    amount: entry.amount,
    notes: entry.notes,
  }));
}

async function checked(input: OtherIncomeInput, current?: OtherIncomeDoc) {
  if (input.date > hkToday()) throw validationError({ date: 'This cannot be in the future' });
  await companyForInput(input.companyId, current?.companyId);
  assertCategories(await loadCategories(), 'income', [input.categoryId], () => 'categoryId', new Set(current ? [String(current.categoryId)] : []));
  return input;
}

async function load(id: unknown): Promise<OtherIncomeDoc> {
  const entry = await OtherIncome.findById(objectId(id, 'That entry'));
  if (!entry) throw notFound('That entry');
  return entry;
}

const router = Router();
router.use(requirePermission('otherIncome.manage'));

router.get(
  '/',
  route(async (req, res) => {
    const filter: Record<string, unknown> = {};
    const companyId = queryString(req, 'companyId');
    if (companyId) filter.companyId = objectId(companyId, 'That company');
    res.json(await dtos(await OtherIncome.find(filter).sort({ date: -1, createdAt: -1 })));
  }),
);

router.post(
  '/',
  route(async (req, res) => {
    const user = currentUser(req);
    const input = await checked(parse(otherIncomeInputSchema, req.body));
    const entry = await OtherIncome.create({ ...input, createdById: user._id, createdByName: user.name });
    res.status(201).json((await dtos([entry]))[0]);
  }),
);

router.put(
  '/:id',
  route(async (req, res) => {
    const input = parse(otherIncomeInputSchema, req.body);
    const entry = await load(req.params.id);
    entry.set(await checked(input, entry));
    await entry.save();
    res.json((await dtos([entry]))[0]);
  }),
);

router.delete(
  '/:id',
  route(async (req, res) => {
    await (await load(req.params.id)).deleteOne();
    res.status(204).end();
  }),
);

export default router;
