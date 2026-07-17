import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearNeedsReviewAction } from '@/app/actions/import';
import { db } from '@/lib/db';
import { proposals } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@/lib/auth/helpers', () => ({
  requireRole: vi.fn().mockResolvedValue({ userId: 1, name: 'Test Coordinator', role: 'coordinator' }),
}));

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Import Actions - clearNeedsReviewAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error if proposal is not found', async () => {
    // Setup mock to return empty array (not found)
    vi.mocked(db.limit).mockResolvedValueOnce([]);

    const result = await clearNeedsReviewAction(999);

    expect(result.error).toBe('Proposal tidak ditemukan.');
  });

  it('should successfully clear needsReview flag', async () => {
    // Setup mock to return a proposal
    vi.mocked(db.limit).mockResolvedValueOnce([{
      id: 1,
      needsReview: true,
      title: 'Test Proposal',
    }]);

    const result = await clearNeedsReviewAction(1);

    expect(result.success).toBe(true);
    expect(db.update).toHaveBeenCalledWith(proposals);
    expect(db.set).toHaveBeenCalledWith({
      needsReview: false,
      updatedAt: expect.any(Date),
    });
  });
});
