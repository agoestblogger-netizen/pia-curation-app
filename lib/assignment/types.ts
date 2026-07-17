/**
 * Types shared across all assignment algorithms.
 */

export interface ProposalItem {
  id: number;
  category: string;
}

export interface CuratorInfo {
  id: number;
  name: string;
}

export interface AssignmentResult {
  proposalId: number;
  curatorId: number;
  category: string;
}

export interface CategoryCount {
  WILAYAH: number;
  PUSAT: number;
  BI: number;
  BC: number;
  [key: string]: number;
}

export function groupByCategory(proposals: ProposalItem[]): Map<string, ProposalItem[]> {
  const map = new Map<string, ProposalItem[]>();
  for (const p of proposals) {
    if (!map.has(p.category)) map.set(p.category, []);
    map.get(p.category)!.push(p);
  }
  return map;
}

/**
 * Shuffle an array in-place using Fisher-Yates algorithm.
 */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Distribute items as evenly as possible across buckets.
 * Returns array of size `count` where each element is how many items go to that bucket.
 */
export function distributeEvenly(total: number, count: number): number[] {
  if (count === 0) return [];
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Validates that no proposal is assigned more than once.
 */
export function validateNoDoubleAssignment(results: AssignmentResult[]): boolean {
  const ids = results.map((r) => r.proposalId);
  return new Set(ids).size === ids.length;
}

/**
 * Validates that all proposals are assigned.
 */
export function validateAllAssigned(
  proposals: ProposalItem[],
  results: AssignmentResult[]
): boolean {
  const assignedIds = new Set(results.map((r) => r.proposalId));
  return proposals.every((p) => assignedIds.has(p.id));
}
