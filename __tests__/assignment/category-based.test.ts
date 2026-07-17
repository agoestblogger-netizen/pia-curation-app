import { describe, it, expect } from 'vitest';
import { categoryBasedAssign } from '../../lib/assignment/category-based';
import { CuratorInfo, ProposalItem, validateNoDoubleAssignment } from '../../lib/assignment/types';

describe('Category Based Assignment', () => {
  it('assigns proposals based on curator category config', () => {
    const curators: CuratorInfo[] = [
      { id: 1, name: 'C1' },
      { id: 2, name: 'C2' },
      { id: 3, name: 'C3' },
    ];

    const proposals: ProposalItem[] = [
      ...Array.from({ length: 50 }, (_, i) => ({ id: i + 1, category: 'WILAYAH' })),
      ...Array.from({ length: 50 }, (_, i) => ({ id: i + 51, category: 'PUSAT' })),
      ...Array.from({ length: 50 }, (_, i) => ({ id: i + 101, category: 'BI' })),
    ];

    const config = {
      curatorCategories: {
        1: ['WILAYAH'],
        2: ['PUSAT', 'BI'],
        3: ['BI'],
      }
    };

    const results = categoryBasedAssign(proposals, curators, config);

    expect(results.length).toBe(150);
    expect(validateNoDoubleAssignment(results)).toBe(true);

    const c1Assignments = results.filter(r => r.curatorId === 1);
    const c2Assignments = results.filter(r => r.curatorId === 2);
    const c3Assignments = results.filter(r => r.curatorId === 3);

    // C1 should have all WILAYAH (50)
    expect(c1Assignments.length).toBe(50);
    expect(c1Assignments.every(r => r.category === 'WILAYAH')).toBe(true);

    // C2 should have all PUSAT (50) + half of BI (25) = 75
    expect(c2Assignments.length).toBe(75);
    expect(c2Assignments.filter(r => r.category === 'PUSAT').length).toBe(50);
    expect(c2Assignments.filter(r => r.category === 'BI').length).toBe(25);

    // C3 should have half of BI (25)
    expect(c3Assignments.length).toBe(25);
    expect(c3Assignments.every(r => r.category === 'BI')).toBe(true);
  });
});
