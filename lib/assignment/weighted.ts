/**
 * Weighted assignment algorithm.
 * Accounts for curator regional load (WILAYAH + PUSAT assignments) to
 * reduce their BI/BC quota proportionally.
 *
 * Load levels and factors:
 *   none   → 1.00  (no regional proposals → full BI/BC quota)
 *   light  → 0.75
 *   medium → 0.60
 *   high   → 0.40
 */
import {
  ProposalItem,
  CuratorInfo,
  AssignmentResult,
  groupByCategory,
  shuffle,
  distributeEvenly,
} from './types';

export type LoadLevel = 'none' | 'light' | 'medium' | 'high';

export const DEFAULT_FACTORS: Record<LoadLevel, number> = {
  none: 1.0,
  light: 0.75,
  medium: 0.6,
  high: 0.4,
};

export interface WeightedConfig {
  /** How many WILAYAH/PUSAT proposals each curator gets (pre-determined) */
  regionalQuotas: Record<number, number>;
  /** Factor overrides (defaults to DEFAULT_FACTORS) */
  factors?: Partial<Record<LoadLevel, number>>;
  /** Total proposals per category available */
  categoryTotals: Record<string, number>;
}

export function calculateLoadLevel(regionalCount: number, totalRegional: number): LoadLevel {
  if (totalRegional === 0 || regionalCount === 0) return 'none';
  const ratio = regionalCount / totalRegional;
  if (ratio < 0.15) return 'light';
  if (ratio < 0.3) return 'medium';
  return 'high';
}

export interface QuotaRecommendation {
  curatorId: number;
  wilayah: number;
  pusat: number;
  bi: number;
  bc: number;
  regionalLoad: LoadLevel;
  biFactor: number;
}

/**
 * Calculate recommended BI/BC quotas per curator based on regional load.
 */
export function calculateWeightedQuotas(
  curators: CuratorInfo[],
  categoryTotals: Record<string, number>,
  regionalQuotas: Record<number, number>,
  factorOverrides?: Partial<Record<LoadLevel, number>>
): QuotaRecommendation[] {
  const factors = { ...DEFAULT_FACTORS, ...factorOverrides };
  const totalRegional = curators.reduce((sum, c) => sum + (regionalQuotas[c.id] ?? 0), 0);

  // Raw weights based on inverse of regional load factor
  const weights: number[] = curators.map((c) => {
    const regionalCount = regionalQuotas[c.id] ?? 0;
    const loadLevel = calculateLoadLevel(regionalCount, totalRegional);
    return factors[loadLevel];
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const biTotal = categoryTotals['BI'] ?? 0;
  const bcTotal = categoryTotals['BC'] ?? 0;
  const wilayahTotal = categoryTotals['WILAYAH'] ?? 0;
  const pusatTotal = categoryTotals['PUSAT'] ?? 0;

  // Calculate recommended quotas
  let biAllocated = 0;
  let bcAllocated = 0;
  let wilayahAllocated = 0;
  let pusatAllocated = 0;

  const recommendations: QuotaRecommendation[] = curators.map((c, i) => {
    const regionalCount = regionalQuotas[c.id] ?? 0;
    const loadLevel = calculateLoadLevel(regionalCount, totalRegional);
    const weight = weights[i];
    const proportion = totalWeight > 0 ? weight / totalWeight : 1 / curators.length;

    const bi = Math.floor(biTotal * proportion);
    const bc = Math.floor(bcTotal * proportion);
    const wilayah = regionalQuotas[c.id] ?? Math.floor(wilayahTotal / curators.length);
    const pusat = Math.floor(pusatTotal / curators.length);

    biAllocated += bi;
    bcAllocated += bc;
    wilayahAllocated += wilayah;
    pusatAllocated += pusat;

    return {
      curatorId: c.id,
      wilayah,
      pusat,
      bi,
      bc,
      regionalLoad: loadLevel,
      biFactor: weight,
    };
  });

  // Distribute remainders to first curators
  const biRemainder = biTotal - biAllocated;
  const bcRemainder = bcTotal - bcAllocated;

  for (let i = 0; i < biRemainder && i < recommendations.length; i++) {
    recommendations[i].bi++;
  }
  for (let i = 0; i < bcRemainder && i < recommendations.length; i++) {
    recommendations[i].bc++;
  }

  return recommendations;
}

/**
 * Weighted distribution — uses quota recommendations to distribute proposals.
 */
export function weightedAssign(
  proposals: ProposalItem[],
  curators: CuratorInfo[],
  quotas: QuotaRecommendation[]
): AssignmentResult[] {
  const byCategory = groupByCategory(proposals);
  const results: AssignmentResult[] = [];

  const categories = ['WILAYAH', 'PUSAT', 'BI', 'BC'] as const;
  const quotaKeys: Record<string, keyof QuotaRecommendation> = {
    WILAYAH: 'wilayah',
    PUSAT: 'pusat',
    BI: 'bi',
    BC: 'bc',
  };

  for (const category of categories) {
    const catProposals = shuffle([...(byCategory.get(category) ?? [])]);
    if (catProposals.length === 0) continue;

    // Get quota for this category per curator
    const curatorQuotas = curators.map((c) => {
      const q = quotas.find((r) => r.curatorId === c.id);
      return q ? (q[quotaKeys[category]] as number) : 0;
    });

    let remaining = [...catProposals];
    for (let i = 0; i < curators.length; i++) {
      const quota = curatorQuotas[i];
      if (quota <= 0) continue;
      const chunk = remaining.splice(0, quota);
      for (const p of chunk) {
        results.push({ proposalId: p.id, curatorId: curators[i].id, category });
      }
    }

    // Distribute any remaining proposals that didn't fit quota
    if (remaining.length > 0) {
      const extraQuotas = distributeEvenly(remaining.length, curators.length);
      let offset = 0;
      for (let i = 0; i < curators.length; i++) {
        const chunk = remaining.slice(offset, offset + extraQuotas[i]);
        offset += extraQuotas[i];
        for (const p of chunk) {
          results.push({ proposalId: p.id, curatorId: curators[i].id, category });
        }
      }
    }
  }

  return results;
}
