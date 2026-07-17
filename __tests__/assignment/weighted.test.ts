import { describe, it, expect } from 'vitest';
import { calculateWeightedQuotas, calculateLoadLevel, weightedAssign } from '../../lib/assignment/weighted';
import { CuratorInfo, ProposalItem, validateNoDoubleAssignment } from '../../lib/assignment/types';

describe('Weighted Assignment', () => {
  it('calculates load level correctly', () => {
    expect(calculateLoadLevel(0, 100)).toBe('none');
    expect(calculateLoadLevel(10, 100)).toBe('light'); // 10%
    expect(calculateLoadLevel(20, 100)).toBe('medium'); // 20%
    expect(calculateLoadLevel(40, 100)).toBe('high'); // 40%
  });

  it('calculates recommended quotas proportionally', () => {
    const curators: CuratorInfo[] = [
      { id: 1, name: 'C1' },
      { id: 2, name: 'C2' },
      { id: 3, name: 'C3' },
    ];

    const categoryTotals = {
      WILAYAH: 0,
      PUSAT: 0,
      BI: 300,
      BC: 0,
    };

    // C1 has high load (80), C2 has light load (10), C3 has light load (10)
    // Total regional = 100
    // C1 ratio = 0.8 -> high load (factor 0.4)
    // C2 ratio = 0.1 -> light load (factor 0.75)
    // C3 ratio = 0.1 -> light load (factor 0.75)
    // Total weight = 1.9
    // C1 share = 0.4 / 1.9 = 21% -> ~63
    // C2 share = 0.75 / 1.9 = 39.4% -> ~118
    // C3 share = 0.75 / 1.9 = 39.4% -> ~118
    const regionalQuotas = {
      1: 80,
      2: 10,
      3: 10,
    };

    const quotas = calculateWeightedQuotas(curators, categoryTotals, regionalQuotas);

    const c1 = quotas.find(q => q.curatorId === 1)!;
    const c2 = quotas.find(q => q.curatorId === 2)!;
    const c3 = quotas.find(q => q.curatorId === 3)!;

    expect(c1.regionalLoad).toBe('high');
    expect(c2.regionalLoad).toBe('light');

    expect(c1.bi).toBeLessThan(c2.bi); // High regional load = lower BI quota
    expect(c2.bi).toBe(c3.bi); // Same load = same quota
    
    // Total assigned BI should equal total available
    expect(c1.bi + c2.bi + c3.bi).toBe(300);
  });

  it('assigns proposals according to quotas', () => {
    const curators: CuratorInfo[] = [
      { id: 1, name: 'C1' },
      { id: 2, name: 'C2' },
    ];

    const proposals: ProposalItem[] = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      category: 'BI',
    }));

    const quotas = [
      { curatorId: 1, wilayah: 0, pusat: 0, bi: 30, bc: 0, regionalLoad: 'none' as const, biFactor: 1 },
      { curatorId: 2, wilayah: 0, pusat: 0, bi: 70, bc: 0, regionalLoad: 'none' as const, biFactor: 1 },
    ];

    const results = weightedAssign(proposals, curators, quotas);

    expect(results.length).toBe(100);
    expect(validateNoDoubleAssignment(results)).toBe(true);

    const c1Assignments = results.filter(r => r.curatorId === 1).length;
    const c2Assignments = results.filter(r => r.curatorId === 2).length;

    expect(c1Assignments).toBe(30);
    expect(c2Assignments).toBe(70);
  });
});
