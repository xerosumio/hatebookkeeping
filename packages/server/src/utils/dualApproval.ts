import { User } from '../models/User.js';

// Names of the two required approvers — both must approve for full approval.
const REQUIRED_APPROVER_NAMES = ['William', 'Andy'];

/**
 * Returns the User IDs of the two required approvers.
 * Matches by first-name prefix (case-insensitive) so "William Pang" still matches "William".
 */
export async function getRequiredApproverIds(): Promise<string[]> {
  const regexes = REQUIRED_APPROVER_NAMES.map(
    (n) => new RegExp(`^${n}`, 'i'),
  );
  const users = await User.find({
    role: 'admin',
    active: true,
    $or: regexes.map((r) => ({ name: r })),
  }).select('_id');
  return users.map((u) => u._id.toString());
}

/**
 * Given the current approvals array, returns true when both required
 * approvers have signed off.
 */
export function hasFullApproval(
  approvals: { user: any; at: Date }[],
  requiredIds: string[],
): boolean {
  const approvedSet = new Set(
    approvals.map((a) =>
      typeof a.user === 'object' && a.user._id
        ? a.user._id.toString()
        : a.user.toString(),
    ),
  );
  return requiredIds.every((id) => approvedSet.has(id));
}
