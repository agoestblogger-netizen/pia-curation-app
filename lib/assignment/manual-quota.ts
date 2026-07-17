/**
 * Manual quota assignment algorithm.
 * Distributes exactly the specified number of proposals to each curator,
 * per category, based on Coordinator-defined quotas.
 */
import {
  ProposalItem,
  CuratorInfo,
  AssignmentResult,
  groupByCategory,
  shuffle,
} from './types';

export interface ManualQuotaConfig {
  /** curatorId → category → count */
  quotas: Record<number, Record<string, number>>;
}

export function manualQuotaAssign(
  proposals: ProposalItem[],
  curators: CuratorInfo[],
  config: ManualQuotaConfig
): AssignmentResult[] {
  const byCategory = groupByCategory(proposals);
  const results: AssignmentResult[] = [];

  for (const [category, catProposals] of byCategory) {
    const shuffled = shuffle([...catProposals]);
    let offset = 0;

    for (const curator of curators) {
      const quota = config.quotas[curator.id]?.[category] ?? 0;
      const chunk = shuffled.slice(offset, offset + quota);
      offset += quota;

      for (const p of chunk) {
        results.push({ proposalId: p.id, curatorId: curator.id, category });
      }
    }

    // Remaining unallocated proposals (if quotas don't sum to total)
    // These will be returned unassigned; coordinator must handle manually
  }

  return results;
}

/**
 * Returns list of proposals NOT assigned by manualQuotaAssign
 */
export function findUnassigned(
  proposals: ProposalItem[],
  results: AssignmentResult[]
): ProposalItem[] {
  const assignedIds = new Set(results.map((r) => r.proposalId));
  return proposals.filter((p) => !assignedIds.has(p.id));
}
