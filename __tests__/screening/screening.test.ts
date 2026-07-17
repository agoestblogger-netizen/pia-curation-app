import { describe, it, expect, vi } from 'vitest';
vi.mock('../../lib/db', () => ({ db: {} }));
vi.mock('../../lib/auth/helpers', () => ({ requireRole: vi.fn() }));
import { screeningSchema } from '../../lib/constants/screening';

describe('Screening Actions Validation', () => {
  it('allows valid verdicts from SCREENING_VERDICTS', () => {
    const validData = {
      assignmentId: '1',
      verdict: 'lolos',
      notes: 'Bagus',
    };
    
    const result = screeningSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.verdict).toBe('lolos');
    }
  });

  it('rejects invalid verdict not in the 5 enums', () => {
    const invalidData = {
      assignmentId: '2',
      verdict: 'layak', // Old binary value
      notes: 'Bagus',
    };
    
    const result = screeningSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('rejects arbitrary invalid strings for verdict', () => {
    const invalidData = {
      assignmentId: '3',
      verdict: 'keren',
    };
    
    const result = screeningSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
