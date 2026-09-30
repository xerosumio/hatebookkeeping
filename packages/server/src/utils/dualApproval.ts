import { User } from '../models/User.js';
import { resolvePolicy } from '../access/policy.js';

/** Active users who must all approve. Empty means one allowed approval is enough. */
export async function getRequiredApproverIds(): Promise<string[]> {
  const policy = await resolvePolicy();
  if (policy.approverIds.length === 0) return [];
  const users = await User.find({
    _id: { $in: policy.approverIds },
    active: true,
  }).select('_id');
  return users.map((user) => user._id.toString());
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
