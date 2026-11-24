import type { CategoryDto, CategoryType, SystemCategory } from '@hbk/shared';
import { AppError, validationError } from '../../platform/errors.js';
import { DEFAULT_CATEGORIES, Settings, type CategoryAttrs, type SettingsDoc } from './model.js';

/** The single settings record, created with the default categories on first use. */
export async function getSettings(): Promise<SettingsDoc> {
  const existing = await Settings.findOne({ key: 'main' });
  if (existing) return existing;
  try {
    return await Settings.create({ key: 'main', categories: DEFAULT_CATEGORIES, approverIds: [], approvalsRequired: 1 });
  } catch (err) {
    // Two first requests raced; the unique key let only one create it.
    const created = await Settings.findOne({ key: 'main' });
    if (created) return created;
    throw err;
  }
}

export function categoryDto(category: CategoryAttrs): CategoryDto {
  return {
    id: String(category._id),
    name: category.name,
    type: category.type,
    active: category.active,
    system: category.system ?? null,
  };
}

export type CategoryLookup = Map<string, CategoryAttrs>;

export function categoryLookup(settings: SettingsDoc): CategoryLookup {
  return new Map(settings.categories.map((category) => [String(category._id), category]));
}

export async function loadCategories(): Promise<CategoryLookup> {
  return categoryLookup(await getSettings());
}

export function categoryName(lookup: CategoryLookup, id: unknown): string {
  return lookup.get(String(id))?.name ?? 'Removed category';
}

/**
 * Checks category choices on a save. `path(index)` names the form field so the
 * message lands next to the right line. A category already on the saved record
 * stays acceptable after it is switched off.
 */
export function assertCategories(
  lookup: CategoryLookup,
  type: CategoryType,
  ids: readonly string[],
  path: (index: number) => string,
  alreadyUsed: ReadonlySet<string> = new Set(),
): void {
  const fields: Record<string, string> = {};
  ids.forEach((id, index) => {
    const category = lookup.get(id);
    if (!category || category.type !== type) {
      fields[path(index)] = `Choose ${type === 'income' ? 'an income' : 'an expense'} category`;
    } else if (!category.active && !alreadyUsed.has(id)) {
      fields[path(index)] = `"${category.name}" is switched off. Choose another category`;
    } else if (category.system === 'salary' && !alreadyUsed.has(id)) {
      fields[path(index)] = 'Salary is recorded through a salary run. Choose another category';
    } else if (category.system === 'sales' && !alreadyUsed.has(id)) {
      fields[path(index)] = 'Sales come from invoices. Choose another category';
    }
  });
  if (Object.keys(fields).length > 0) throw validationError(fields);
}

export function systemCategoryId(settings: SettingsDoc, system: SystemCategory): string {
  const category = settings.categories.find((candidate) => candidate.system === system);
  if (!category) throw new AppError(500, `The ${system} category is missing from settings.`);
  return String(category._id);
}

// ── Approval policy ─────────────────────────────────────────────────────────

export interface ApprovalPolicy {
  approverIds: string[];
  required: number;
}

export function policyOf(settings: SettingsDoc): ApprovalPolicy {
  return {
    approverIds: settings.approverIds.map(String),
    required: settings.approvalsRequired,
  };
}

export async function approvalPolicy(): Promise<ApprovalPolicy> {
  return policyOf(await getSettings());
}
