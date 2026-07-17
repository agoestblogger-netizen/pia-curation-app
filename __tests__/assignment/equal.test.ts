import { describe, it, expect } from 'vitest';
import { equalAssign } from '../../lib/assignment/equal';
import { ProposalItem, CuratorInfo, validateNoDoubleAssignment, validateAllAssigned } from '../../lib/assignment/types';

describe('Equal Assignment', () => {
  it('distributes proposals evenly among curators', () => {
    const proposals: ProposalItem[] = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      category: 'WILAYAH',
    }));
    
    const curators: CuratorInfo[] = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `Curator ${i + 1}`,
    }));

    const results = equalAssign(proposals, curators);

    expect(results.length).toBe(100);
    expect(validateNoDoubleAssignment(results)).toBe(true);
    expect(validateAllAssigned(proposals, results)).toBe(true);

    // Each curator should have exactly 10 proposals
    const counts = new Map<number, number>();
    for (const r of results) {
      counts.set(r.curatorId, (counts.get(r.curatorId) ?? 0) + 1);
    }
    
    for (const count of counts.values()) {
      expect(count).toBe(10);
    }
  });

  it('handles remainders correctly', () => {
    const proposals: ProposalItem[] = Array.from({ length: 103 }, (_, i) => ({
      id: i + 1,
      category: 'WILAYAH',
    }));
    
    const curators: CuratorInfo[] = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `Curator ${i + 1}`,
    }));

    const results = equalAssign(proposals, curators);

    expect(results.length).toBe(103);
    expect(validateNoDoubleAssignment(results)).toBe(true);

    const counts = Array.from(
      results.reduce((map, r) => map.set(r.curatorId, (map.get(r.curatorId) ?? 0) + 1), new Map<number, number>()).values()
    );

    // Should have 3 curators with 11 proposals, 7 with 10
    expect(counts.filter((c) => c === 11).length).toBe(3);
    expect(counts.filter((c) => c === 10).length).toBe(7);
  });
});
