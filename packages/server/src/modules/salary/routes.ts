import { Router } from 'express';
import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  hkCurrentMonth,
  addMonthsToMonth,
  lastDayOfMonth,
  monthLabel,
  salaryRunCreateSchema,
  salaryRunUpdateSchema,
  staffInputSchema,
  sumCents,
  type StaffDto,
} from '@hbk/shared';
import { record } from '../../platform/activity.js';
import { currentUser, requirePermission } from '../../platform/auth.js';
import { conflict, notFound, validationError } from '../../platform/errors.js';
import { objectId, parse, queryString, route } from '../../platform/http.js';
import { refOf } from '../../platform/references.js';
import { companyForInput, companyNames, nextInternalNumber } from '../companies/service.js';
import { mountFlow, saveEdit } from '../expenses/flow.js';
import { Expense, type ExpenseItemAttrs } from '../expenses/model.js';
import { assertMayManage, expenseDto, expenseDtos, loadExpense } from '../expenses/service.js';
import { getSettings, systemCategoryId } from '../settings/service.js';

// ── Staff ───────────────────────────────────────────────────────────────────

/** Someone on the payroll. Not a login: a staff member need not be a user of this app. */
export interface StaffAttrs {
  companyId: Types.ObjectId;
  name: string;
  monthlySalary: number;
  bankName: string;
  bankAccountNumber: string;
  fpsId: string;
  notes: string;
  active: boolean;
}

const staffSchema = new Schema<StaffAttrs>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    monthlySalary: { type: Number, required: true },
    bankName: { type: String, default: '' },
    bankAccountNumber: { type: String, default: '' },
    fpsId: { type: String, default: '' },
    notes: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, optimisticConcurrency: true },
);

export const StaffMember = model<StaffAttrs>('StaffMember', staffSchema);
export type StaffDoc = HydratedDocument<StaffAttrs>;

function staffDto(staff: StaffDoc, companies: Map<string, string>): StaffDto {
  return {
    id: String(staff._id),
    company: refOf(companies, staff.companyId),
    name: staff.name,
    monthlySalary: staff.monthlySalary,
    bankName: staff.bankName,
    bankAccountNumber: staff.bankAccountNumber,
    fpsId: staff.fpsId,
    notes: staff.notes,
    active: staff.active,
  };
}

async function loadStaff(id: unknown): Promise<StaffDoc> {
  const staff = await StaffMember.findById(objectId(id, 'That staff member'));
  if (!staff) throw notFound('That staff member');
  return staff;
}

const router = Router();
router.use(requirePermission('salary.view'));

router.get(
  '/staff',
  route(async (req, res) => {
    const filter: Record<string, unknown> = {};
    const companyId = queryString(req, 'companyId');
    if (companyId) filter.companyId = objectId(companyId, 'That company');
    const [staff, companies] = await Promise.all([StaffMember.find(filter).sort({ active: -1, name: 1 }), companyNames()]);
    res.json(staff.map((member) => staffDto(member, companies)));
  }),
);

router.post(
  '/staff',
  requirePermission('salary.manage'),
  route(async (req, res) => {
    const input = parse(staffInputSchema, req.body);
    await companyForInput(input.companyId);
    const staff = await StaffMember.create(input);
    res.status(201).json(staffDto(staff, await companyNames()));
  }),
);

router.put(
  '/staff/:id',
  requirePermission('salary.manage'),
  route(async (req, res) => {
    const input = parse(staffInputSchema, req.body);
    const staff = await loadStaff(req.params.id);
    await companyForInput(input.companyId, staff.companyId);
    staff.set(input);
    await staff.save();
    res.json(staffDto(staff, await companyNames()));
  }),
);

/** Someone who has been on a salary run stays on file; switch them off instead. */
router.delete(
  '/staff/:id',
  requirePermission('salary.manage'),
  route(async (req, res) => {
    const staff = await loadStaff(req.params.id);
    const uses = await Expense.countDocuments({ 'items.staffId': staff._id });
    if (uses > 0) {
      throw conflict(`${staff.name} cannot be deleted because they are on ${uses} salary run${uses === 1 ? '' : 's'}. Switch them off instead.`);
    }
    await staff.deleteOne();
    res.status(204).end();
  }),
);

// ── Salary runs ─────────────────────────────────────────────────────────────

/**
 * A salary run is one month's salaries for one company: a line per staff
 * member, filed under the Salary category. It is approved and paid through
 * the same steps as an expense. There is one run per company and month; a
 * reversed run frees the month for a new one.
 */

const slotOf = (companyId: unknown, month: string) => `${String(companyId)}:${month}`;

function lineOf(staff: Pick<StaffDoc, '_id' | 'name'>, amount: number, note: string, month: string, categoryId: string): ExpenseItemAttrs {
  return {
    description: staff.name,
    categoryId: objectId(categoryId),
    amount,
    // The whole month's salary counts on the month's last day in "Billed / committed".
    date: lastDayOfMonth(month),
    receiptFileId: null,
    staffId: staff._id,
    note,
  };
}

router.get(
  '/runs',
  route(async (req, res) => {
    const filter: Record<string, unknown> = { kind: 'salary' };
    const companyId = queryString(req, 'companyId');
    if (companyId) filter.companyId = objectId(companyId, 'That company');
    const runs = await Expense.find(filter).sort({ salaryMonth: -1, createdAt: -1 });
    res.json(await expenseDtos(runs, currentUser(req)));
  }),
);

router.get(
  '/runs/:id',
  route(async (req, res) => {
    const user = currentUser(req);
    res.json(await expenseDto(await loadExpense(req.params.id, 'salary', user), user));
  }),
);

/** Starts the run for a month, with a line for each active staff member at their monthly salary. */
router.post(
  '/runs',
  requirePermission('salary.manage'),
  route(async (req, res) => {
    const input = parse(salaryRunCreateSchema, req.body);
    const user = currentUser(req);
    const company = await companyForInput(input.companyId);
    if (input.month > addMonthsToMonth(hkCurrentMonth(), 1)) throw validationError({ month: 'A salary run can be prepared at most one month ahead' });

    const staff = await StaffMember.find({ companyId: company._id, active: true }).sort({ name: 1 });
    if (staff.length === 0) {
      throw conflict(`${company.name} has no active staff. Add them to the staff list before starting a salary run.`);
    }
    const categoryId = systemCategoryId(await getSettings(), 'salary');
    const items = staff.map((member) => lineOf(member, member.monthlySalary, '', input.month, categoryId));

    const run = new Expense({
      kind: 'salary',
      number: await nextInternalNumber('salary'),
      companyId: company._id,
      title: `Salary for ${monthLabel(input.month)}`,
      salaryMonth: input.month,
      salarySlot: slotOf(company._id, input.month),
      expenseDate: lastDayOfMonth(input.month),
      items,
      total: sumCents(items.map((item) => item.amount)),
      authorIds: [user._id],
      createdById: user._id,
      createdByName: user.name,
    });
    record(run, user, 'Created', `${staff.length} staff`);
    try {
      await run.save();
    } catch (err) {
      // The unique slot is what makes "one run per month" hold even when two people start one at once.
      if ((err as { code?: number }).code === 11000) {
        throw conflict(`There is already a salary run for ${monthLabel(input.month)}. Open that one, or have an admin reverse it first.`);
      }
      throw err;
    }
    res.status(201).json(await expenseDto(run, user));
  }),
);

/** Adjusts the run: change an amount, add a note, leave someone out or add someone in. */
router.put(
  '/runs/:id',
  route(async (req, res) => {
    const input = parse(salaryRunUpdateSchema, req.body);
    const user = currentUser(req);
    const run = await loadExpense(req.params.id, 'salary', user);
    assertMayManage(run, user);
    const month = run.salaryMonth as string;

    const fields: Record<string, string> = {};
    const seen = new Set<string>();
    input.lines.forEach((line, index) => {
      if (seen.has(line.staffId)) fields[`lines.${index}.staffId`] = 'This person is already on the run';
      seen.add(line.staffId);
    });
    const staff = await StaffMember.find({ _id: { $in: [...seen] } });
    const byId = new Map(staff.map((member) => [String(member._id), member]));
    const already = new Set(run.items.map((item) => String(item.staffId)));
    input.lines.forEach((line, index) => {
      const member = byId.get(line.staffId);
      if (!member || String(member.companyId) !== String(run.companyId)) fields[`lines.${index}.staffId`] = 'Choose someone on this company’s staff list';
      else if (!member.active && !already.has(line.staffId)) fields[`lines.${index}.staffId`] = `${member.name} is switched off`;
    });
    if (Object.keys(fields).length > 0) throw validationError(fields);
    if (input.lines.every((line) => line.amount === 0)) throw validationError({ lines: 'Enter at least one amount above zero' });

    const categoryId = systemCategoryId(await getSettings(), 'salary');
    const items = input.lines.map((line) => lineOf(byId.get(line.staffId)!, line.amount, line.note, month, categoryId));
    await saveEdit(run, user, () => {
      run.set({ items, total: sumCents(items.map((item) => item.amount)), notes: input.notes });
    });
    res.json(await expenseDto(await loadExpense(req.params.id, 'salary', user), user));
  }),
);

const runRouter = Router();
mountFlow(runRouter, 'salary');
router.use('/runs', runRouter);

export default router;
