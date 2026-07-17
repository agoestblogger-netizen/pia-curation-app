/**
 * Category-based assignment algorithm.
 * Each curator gets proposals from specific categories as specified.
 * Distributes evenly within each category group.
 */
import {
  ProposalItem,
  CuratorInfo,
  AssignmentResult,
  groupByCategory,
  shuffle,
  distributeEvenly,
} from './types';

export interface CategoryBasedConfig {
  /** Map of curatorId → array of categories they should receive */
  curatorCategories: Record<number, string[]>;
}

export function categoryBasedAssign(
  proposals: ProposalItem[],
  curators: CuratorInfo[],
  config: CategoryBasedConfig
): AssignmentResult[] {
  const byCategory = groupByCategory(proposals);
  const results: AssignmentResult[] = [];

  // For each category, find curators assigned to it and distribute
  const categories = Array.from(byCategory.keys());

  for (const category of categories) {
    const categoryProposals = shuffle([...(byCategory.get(category) ?? [])]);
    
    // Find curators that handle this category
    const categoryCurators = curators.filter((c) =>
      config.curatorCategories[c.id]?.includes(category)
    );

    if (categoryCurators.length === 0) {
      // If no curator assigned to this category, fall back to all curators
      const allCuratorsForCategory = curators;
      const quotas = distributeEvenly(categoryProposals.length, allCuratorsForCategory.length);
      let offset = 0;
      for (let i = 0; i < allCuratorsForCategory.length; i++) {
        const chunk = categoryProposals.slice(offset, offset + quotas[i]);
        offset += quotas[i];
        for (const p of chunk) {
          results.push({ proposalId: p.id, curatorId: allCuratorsForCategory[i].id, category });
        }
      }
      continue;
    }

    const quotas = distributeEvenly(categoryProposals.length, categoryCurators.length);
    let offset = 0;
    for (let i = 0; i < categoryCurators.length; i++) {
      const chunk = categoryProposals.slice(offset, offset + quotas[i]);
      offset += quotas[i];
      for (const p of chunk) {
        results.push({ proposalId: p.id, curatorId: categoryCurators[i].id, category });
      }
    }
  }

  return results;
}
