import { Router } from 'express';
import { companyInputSchema, numberingInputSchema } from '@hbk/shared';
import { allowed, currentUser, requirePermission } from '../../platform/auth.js';
import { notFound, validationError } from '../../platform/errors.js';
import { objectId, parse, route } from '../../platform/http.js';
import { assertFilesUsable } from '../files/service.js';
import { Company } from './model.js';
import { companyDto, companyNameOnly, numberingOf, setNumbering } from './service.js';

const router = Router();

/** Everyone signed in can see which companies exist; only the office sees their details. */
router.get(
  '/',
  route(async (req, res) => {
    const companies = await Company.find().sort({ name: 1 });
    const full = allowed(req, 'companies.view');
    res.json(companies.map((company) => (full ? companyDto(company) : companyNameOnly(company))));
  }),
);

async function assertCodeFree(code: string, exceptId?: unknown): Promise<void> {
  const taken = await Company.findOne({ code, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }).select('_id');
  if (taken) throw validationError({ code: `Another company already uses ${code}` });
}

const brandingEntries = (input: { logoFileId: string | null; chopFileId: string | null; signatureFileId: string | null }) => [
  { id: input.logoFileId, path: 'logoFileId' },
  { id: input.chopFileId, path: 'chopFileId' },
  { id: input.signatureFileId, path: 'signatureFileId' },
];

router.post(
  '/',
  requirePermission('settings.manage'),
  route(async (req, res) => {
    const input = parse(companyInputSchema, req.body);
    await assertCodeFree(input.code);
    await assertFilesUsable(currentUser(req), 'branding', brandingEntries(input));
    const company = await Company.create(input);
    res.status(201).json(companyDto(company));
  }),
);

router.put(
  '/:id',
  requirePermission('settings.manage'),
  route(async (req, res) => {
    const input = parse(companyInputSchema, req.body);
    const company = await Company.findById(objectId(req.params.id, 'That company'));
    if (!company) throw notFound('That company');
    await assertCodeFree(input.code, company._id);
    await assertFilesUsable(currentUser(req), 'branding', brandingEntries(input));
    company.set(input);
    await company.save();
    res.json(companyDto(company));
  }),
);

router.get(
  '/:id/numbering',
  requirePermission('settings.manage'),
  route(async (req, res) => {
    const id = objectId(req.params.id, 'That company');
    if (!(await Company.exists({ _id: id }))) throw notFound('That company');
    res.json(await numberingOf(String(id)));
  }),
);

router.put(
  '/:id/numbering',
  requirePermission('settings.manage'),
  route(async (req, res) => {
    const input = parse(numberingInputSchema, req.body);
    const id = objectId(req.params.id, 'That company');
    if (!(await Company.exists({ _id: id }))) throw notFound('That company');
    res.json(await setNumbering(String(id), input));
  }),
);

export default router;
