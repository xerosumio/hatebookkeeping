import type { Types } from 'mongoose';
import { hkToday, type CompanyDto, type NumberingDto, type Ref } from '@hbk/shared';
import { validationError } from '../../platform/errors.js';
import { Company, Counter, type CompanyDoc } from './model.js';

export function companyDto(company: CompanyDoc): CompanyDto {
  const fileId = (value: Types.ObjectId | null) => (value ? String(value) : null);
  return {
    id: String(company._id),
    code: company.code,
    name: company.name,
    address: company.address,
    phone: company.phone,
    email: company.email,
    website: company.website,
    brandColor: company.brandColor,
    bankDetails: company.bankDetails,
    quoteTerms: company.quoteTerms,
    logoFileId: fileId(company.logoFileId),
    chopFileId: fileId(company.chopFileId),
    signatureFileId: fileId(company.signatureFileId),
    active: company.active,
  };
}

/** What someone without office access may know about a company: enough to pick it on a claim. */
export function companyNameOnly(company: CompanyDoc): CompanyDto {
  return {
    ...companyDto(company),
    address: '',
    phone: '',
    email: '',
    website: '',
    bankDetails: '',
    quoteTerms: '',
    logoFileId: null,
    chopFileId: null,
    signatureFileId: null,
  };
}

export const companyRef = (company: Pick<CompanyDoc, '_id' | 'name'>): Ref => ({ id: String(company._id), name: company.name });

/**
 * The company a new record is being filed under. It has to exist and still be
 * in use; a record already saved under a company that was later switched off
 * may keep it.
 */
export async function companyForInput(companyId: string, current?: unknown): Promise<CompanyDoc> {
  const company = await Company.findById(companyId);
  if (!company) throw validationError({ companyId: 'Choose a company' });
  if (!company.active && String(current ?? '') !== companyId) {
    throw validationError({ companyId: `${company.name} is switched off. Choose another company` });
  }
  return company;
}

export async function companyNames(): Promise<Map<string, string>> {
  const companies = await Company.find().select('name');
  return new Map(companies.map((company) => [String(company._id), company.name]));
}

// ── Document numbers ────────────────────────────────────────────────────────

export type CustomerSeries = 'quote' | 'invoice' | 'receipt';
export type InternalSeries = 'expense' | 'claim' | 'salary';

const PREFIX: Record<CustomerSeries | InternalSeries, string> = {
  quote: 'QUO',
  invoice: 'INV',
  receipt: 'REC',
  expense: 'EXP',
  claim: 'CLM',
  salary: 'SAL',
};

const currentYear = () => Number(hkToday().slice(0, 4));
const pad = (seq: number) => String(seq).padStart(4, '0');

async function take(key: string): Promise<number> {
  const counter = await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return counter.seq;
}

/** The next quote, invoice or receipt number for a company, e.g. AX-INV-2026-0007. Never reused. */
export async function nextCustomerNumber(company: Pick<CompanyDoc, '_id' | 'code'>, series: CustomerSeries): Promise<string> {
  const year = currentYear();
  const seq = await take(`${String(company._id)}:${series}:${year}`);
  return `${company.code}-${PREFIX[series]}-${year}-${pad(seq)}`;
}

/** Numbers for records that never leave the office, e.g. EXP-2026-0012. */
export async function nextInternalNumber(series: InternalSeries): Promise<string> {
  const year = currentYear();
  const seq = await take(`${series}:${year}`);
  return `${PREFIX[series]}-${year}-${pad(seq)}`;
}

const SERIES: CustomerSeries[] = ['quote', 'invoice', 'receipt'];

export async function numberingOf(companyId: string): Promise<NumberingDto> {
  const year = currentYear();
  const counters = await Counter.find({ key: { $in: SERIES.map((series) => `${companyId}:${series}:${year}`) } });
  const next = (series: CustomerSeries) =>
    (counters.find((counter) => counter.key === `${companyId}:${series}:${year}`)?.seq ?? 0) + 1;
  return { year, quote: next('quote'), invoice: next('invoice'), receipt: next('receipt') };
}

/**
 * Sets the number the next document will get. It can be raised (to carry on
 * from an older system) but never lowered, so a number is never issued twice.
 */
export async function setNumbering(companyId: string, wanted: Record<CustomerSeries, number>): Promise<NumberingDto> {
  const now = await numberingOf(companyId);
  const fields: Record<string, string> = {};
  for (const series of SERIES) {
    if (wanted[series] < now[series]) {
      fields[series] = `This cannot go below ${now[series]}: earlier numbers may already be in use`;
    }
  }
  if (Object.keys(fields).length > 0) throw validationError(fields);

  await Promise.all(
    SERIES.map((series) =>
      Counter.updateOne(
        { key: `${companyId}:${series}:${now.year}` },
        { $max: { seq: wanted[series] - 1 } },
        { upsert: true },
      ),
    ),
  );
  return numberingOf(companyId);
}
