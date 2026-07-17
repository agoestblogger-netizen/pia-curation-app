import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setRegionalFinalistsAction, lockRegionalGroupAction } from '@/app/actions/regional-final';
import { db } from '@/lib/db';
import { proposals } from '@/lib/db/schema';
import { eq, inArray, and } from 'drizzle-orm';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@/lib/auth/helpers', () => ({
  requireRole: vi.fn().mockResolvedValue({ userId: 1, role: 'coordinator' }),
}));

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Regional Final Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setRegionalFinalistsAction', () => {
    it('should return error if more than 10 finalists selected', async () => {
      const finalistIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const result = await setRegionalFinalistsAction(1, 'Kanwil I Medan', finalistIds);
      expect(result.error).toBe('Maksimal 10 finalis per grup.');
    });

    it('should successfully set finalists', async () => {
      vi.mocked(db.where).mockResolvedValueOnce([
        { id: 1, status: 'curation_passed' },
        { id: 2, status: 'curation_passed' },
      ]);

      const result = await setRegionalFinalistsAction(1, 'Kanwil I Medan', [1]);
      
      expect(result.success).toBe(true);
      expect(db.update).toHaveBeenCalledWith(proposals);
      // Since 1 was added, there should be an update call for it
    });
  });

  describe('lockRegionalGroupAction', () => {
    it('should return error if no finalists selected', async () => {
      vi.mocked(db.where).mockResolvedValueOnce([
        { id: 1, status: 'curation_passed' }, // Not a finalist
      ]);

      const result = await lockRegionalGroupAction(1, 'Kanwil I Medan');
      expect(result.error).toBe('Pilih minimal 1 finalis sebelum mengunci grup.');
    });

    it('should successfully lock group and takeout non-finalists', async () => {
      vi.mocked(db.where).mockResolvedValueOnce([
        { id: 1, status: 'regional_finalist' },
        { id: 2, status: 'curation_passed' },
      ]);

      const result = await lockRegionalGroupAction(1, 'Kanwil I Medan');
      
      expect(result.success).toBe(true);
      expect(result.finalistCount).toBe(1);
      expect(result.takeoutCount).toBe(1);
      expect(db.update).toHaveBeenCalledWith(proposals);
      expect(db.set).toHaveBeenCalledWith(expect.objectContaining({
        status: 'takeout',
        takeoutReason: 'not_selected_regional_final'
      }));
    });
  });
});
