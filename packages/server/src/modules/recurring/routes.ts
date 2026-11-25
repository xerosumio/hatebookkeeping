import { Router } from 'express';
import { recurringInputSchema, recurringPeriodSchema, type RecurringInput } from '@hbk/shared';
import { currentUser, requirePermission } from '../../platform/auth.js';
import { notFound, validationError } from '../../platform/errors.js';
import { objectId, parse, queryString, route } from '../../platform/http.js';
import { registerJob } from '../../jobs/scheduler.js';
import { clientForInput } from '../clients/routes.js';
import { companyForInput } from '../companies/service.js';
import { payeeForInput } from '../payees/routes.js';
import { assertCategories, loadCategories } from '../settings/service.js';
import { RecurringItem, RecurringRun, type RecurringDoc } from './model.js';
import { generateDue, generatePeriod, recurringDtos, sendRecurringReminders, skipPeriod } from './service.js';

registerJob({ name: 'recurring reminders', schedule: '0 8 * * *', run: () => sendRecurringReminders() });

async function load(id: unknown): Promise<RecurringDoc> {
  const item = await RecurringItem.findById(objectId(id, 'That recurring item'));
  if (!item) throw notFound('That recurring item');
  return item;
}

/** Checks what the form points at, and returns the fields to store. An invoice has no payee or category; an expense has no client. */
async function checked(input: RecurringInput, current?: RecurringDoc) {
  if (current && current.kind !== input.kind) throw validationError({ kind: 'This cannot be changed. Add a new recurring item instead' });
  await companyForInput(input.companyId, current?.companyId);
  if (input.kind === 'invoice') {
    await clientForInput(input.clientId as string, current?.clientId);
    return { ...input, payeeId: null, categoryId: null };
  }
  await payeeForInput(input.payeeId as string, current?.payeeId);
  assertCategories(await loadCategories(), 'expense', [input.categoryId as string], () => 'categoryId', new Set(current?.categoryId ? [String(current.categoryId)] : []));
  return { ...input, clientId: null };
}

const router = Router();
router.use(requirePermission('recurring.view'));

router.get(
  '/',
  route(async (req, res) => {
    const filter: Record<string, unknown> = {};
    const companyId = queryString(req, 'companyId');
    if (companyId) filter.companyId = objectId(companyId, 'That company');
    res.json(await recurringDtos(await RecurringItem.find(filter).sort({ active: -1, name: 1 })));
  }),
);

router.post(
  '/',
  requirePermission('recurring.manage'),
  route(async (req, res) => {
    const user = currentUser(req);
    const fields = await checked(parse(recurringInputSchema, req.body));
    const item = await RecurringItem.create({ ...fields, createdById: user._id, createdByName: user.name });
    res.status(201).json((await recurringDtos([item]))[0]);
  }),
);

/** Generates every due period of every item, reporting each one separately. */
router.post(
  '/generate-due',
  requirePermission('recurring.manage'),
  route(async (req, res) => {
    const companyId = queryString(req, 'companyId');
    res.json(await generateDue(currentUser(req), companyId ? String(objectId(companyId, 'That company')) : null));
  }),
);

router.put(
  '/:id',
  requirePermission('recurring.manage'),
  route(async (req, res) => {
    const input = parse(recurringInputSchema, req.body);
    const item = await load(req.params.id);
    item.set(await checked(input, item));
    await item.save();
    res.json((await recurringDtos([item]))[0]);
  }),
);

router.post(
  '/:id/generate',
  requirePermission('recurring.manage'),
  route(async (req, res) => {
    const { period } = parse(recurringPeriodSchema, req.body);
    const item = await load(req.params.id);
    const document = await generatePeriod(item, period, currentUser(req));
    res.status(201).json({ document, item: (await recurringDtos([item]))[0] });
  }),
);

/** Passes over one period without creating anything, e.g. a month with no bill. */
router.post(
  '/:id/skip',
  requirePermission('recurring.manage'),
  route(async (req, res) => {
    const { period } = parse(recurringPeriodSchema, req.body);
    const item = await load(req.params.id);
    await skipPeriod(item, period, currentUser(req));
    res.json((await recurringDtos([item]))[0]);
  }),
);

/** Removes the schedule. Invoices and expenses it already produced stay where they are. */
router.delete(
  '/:id',
  requirePermission('recurring.manage'),
  route(async (req, res) => {
    const item = await load(req.params.id);
    await item.deleteOne();
    await RecurringRun.deleteMany({ itemId: item._id });
    res.status(204).end();
  }),
);

export default router;
