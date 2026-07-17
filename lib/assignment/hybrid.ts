/**
 * Hybrid assignment algorithm.
 * Combines weighted (for BI/BC) and category-based (for WILAYAH/PUSAT).
 * This is the recommended mode when curators have mixed regional loads.
 */
import {
  ProposalItem,
  CuratorInfo,
  AssignmentResult,
  groupByCategory,
} from './types';
import { categoryBasedAssign, CategoryBasedConfig } from './category-based';
import { weightedAssign, QuotaRecommendation } from './weighted';

export interface HybridConfig {
  /** For WILAYAH/PUSAT: which curators handle which categories */
  categoryConfig: CategoryBasedConfig;
  /** For BI/BC: quota recommendations from weighted algorithm */
  weightedQuotas: QuotaRecommendation[];
}

export function hybridAssign(
  proposals: ProposalItem[],
  curators: CuratorInfo[],
  config: HybridConfig
): AssignmentResult[] {
  const byCategory = groupByCategory(proposals);

  // Split proposals by regional vs BI/BC
  const regionalProposals = [
    ...(byCategory.get('WILAYAH') ?? []),
    ...(byCategory.get('PUSAT') ?? []),
  ];
  const biProposals = byCategory.get('BI') ?? [];
  const bcProposals = byCategory.get('BC') ?? [];

  // Assign WILAYAH and PUSAT using category-based
  const regionalResults = categoryBasedAssign(regionalProposals, curators, config.categoryConfig);

  // Assign BI and BC using weighted
  const biBcResults = weightedAssign([...biProposals, ...bcProposals], curators, config.weightedQuotas);

  return [...regionalResults, ...biBcResults];
}
