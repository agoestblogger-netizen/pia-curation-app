/**
 * Equal distribution algorithm.
 * Distributes proposals as evenly as possible across curators,
 * ignoring category (round-robin across all proposals).
 */
import {
  ProposalItem,
  CuratorInfo,
  AssignmentResult,
  shuffle,
  distributeEvenly,
} from './types';

export function equalAssign(
  proposals: ProposalItem[],
  curators: CuratorInfo[]
): AssignmentResult[] {
  if (curators.length === 0) return [];

  const shuffled = shuffle([...proposals]);
  const quotas = distributeEvenly(shuffled.length, curators.length);

  const results: AssignmentResult[] = [];
  let offset = 0;

  for (let i = 0; i < curators.length; i++) {
    const quota = quotas[i];
    const chunk = shuffled.slice(offset, offset + quota);
    offset += quota;

    for (const proposal of chunk) {
      results.push({
        proposalId: proposal.id,
        curatorId: curators[i].id,
        category: proposal.category,
      });
    }
  }

  return results;
}
