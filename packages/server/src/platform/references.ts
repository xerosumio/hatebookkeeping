import type { Model } from 'mongoose';
import type { Ref } from '@hbk/shared';
import { conflict } from './errors.js';

/**
 * Records that other records depend on are never deleted out from under them.
 * Each module registers a check ("is this client on any invoice?"); the
 * owner of the record asks all of them before deleting.
 */
export type ReferenceKind = 'client' | 'payee';
type Check = (id: string) => Promise<string | null>;

const checks: Record<ReferenceKind, Check[]> = { client: [], payee: [] };

/** `check` returns what uses the record ("3 invoices"), or null when nothing does. */
export function registerReference(kind: ReferenceKind, check: Check): void {
  checks[kind].push(check);
}

export async function usesOf(kind: ReferenceKind, id: string): Promise<string[]> {
  const found = await Promise.all(checks[kind].map((check) => check(id)));
  return found.filter((use): use is string => use !== null);
}

export async function assertUnused(kind: ReferenceKind, id: string, name: string): Promise<void> {
  const uses = await usesOf(kind, id);
  if (uses.length > 0) {
    throw conflict(`${name} cannot be deleted because it is used by ${uses.join(', ')}. Archive it instead.`);
  }
}

export const countLabel = (count: number, one: string, many = `${one}s`) => (count === 0 ? null : `${count} ${count === 1 ? one : many}`);

/** Names for a set of ids, for building `Ref`s without a query per row. */
export async function namesOf(model: Model<any>, ids: Iterable<unknown>): Promise<Map<string, string>> {
  const unique = [...new Set([...ids].filter(Boolean).map(String))];
  if (unique.length === 0) return new Map();
  const docs = (await model.find({ _id: { $in: unique } }).select('name').lean()) as unknown as { _id: unknown; name: string }[];
  return new Map(docs.map((doc) => [String(doc._id), doc.name]));
}

export const refOf = (names: Map<string, string>, id: unknown, missing = 'Removed'): Ref => ({
  id: String(id),
  name: names.get(String(id)) ?? missing,
});
