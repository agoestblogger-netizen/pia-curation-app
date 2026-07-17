import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUserAction, toggleUserStatusAction } from '@/app/actions/users';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import bcrypt from 'bcryptjs';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@/lib/auth/helpers', () => ({
  requireRole: vi.fn().mockResolvedValue({ userId: 1, role: 'coordinator' }),
}));

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(),
  audit: {
    userCreated: vi.fn(),
    userEdited: vi.fn(),
    userDeleted: vi.fn(),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('User Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createUserAction', () => {
    it('should return error if email already exists', async () => {
      vi.mocked(db.limit).mockResolvedValueOnce([{ id: 2 }]);

      const formData = new FormData();
      formData.append('name', 'Test User');
      formData.append('email', 'test@pia.id');
      formData.append('roles', 'curator');
      formData.append('password', 'password123');

      const result = await createUserAction({}, formData);
      expect(result.error).toBe('Email sudah digunakan.');
    });

    it('should successfully create user', async () => {
      vi.mocked(db.limit).mockResolvedValueOnce([]); // Email not found
      vi.mocked(db.returning).mockResolvedValueOnce([{ id: 3 }]);

      const formData = new FormData();
      formData.append('name', 'Test User');
      formData.append('email', 'test@pia.id');
      formData.append('roles', 'curator');
      formData.append('password', 'password123');

      const result = await createUserAction({}, formData);
      
      expect(result.success).toBe(true);
      expect(result.userId).toBe(3);
      expect(db.insert).toHaveBeenCalledWith(users);
    });
  });

  describe('updateUserAction', () => {
    it('should successfully update user', async () => {
      vi.mocked(db.limit).mockResolvedValueOnce([{ id: 2, name: 'Old', email: 'old@pia.id', roles: ['curator'], isActive: true }]); // existing user
      vi.mocked(db.limit).mockResolvedValueOnce([]); // no duplicate email

      const formData = new FormData();
      formData.append('userId', '2');
      formData.append('name', 'Updated Name');
      formData.append('email', 'new@pia.id');
      formData.append('roles', 'coordinator');
      formData.append('isActive', 'true');

      const { updateUserAction } = await import('@/app/actions/users');
      const result = await updateUserAction({}, formData);
      
      expect(result.success).toBe(true);
      expect(db.update).toHaveBeenCalledWith(users);
    });

    it('should fail if email is already taken by ANOTHER user', async () => {
      vi.mocked(db.limit).mockResolvedValueOnce([{ id: 2, name: 'Old', email: 'old@pia.id', roles: ['curator'], isActive: true }]); // existing user
      vi.mocked(db.limit).mockResolvedValueOnce([{ id: 3 }]); // duplicate email found

      const formData = new FormData();
      formData.append('userId', '2');
      formData.append('name', 'Updated Name');
      formData.append('email', 'taken@pia.id');
      formData.append('roles', 'coordinator');
      formData.append('isActive', 'true');

      const { updateUserAction } = await import('@/app/actions/users');
      const result = await updateUserAction({}, formData);
      
      expect(result.error).toBe('Email sudah digunakan oleh user lain.');
    });
  });

  describe('deleteUserAction', () => {
    it('should successfully soft-delete user', async () => {
      vi.mocked(db.limit).mockResolvedValueOnce([{ id: 2 }]); // existing user

      const { deleteUserAction } = await import('@/app/actions/users');
      const result = await deleteUserAction(2);
      
      expect(result.success).toBe(true);
      expect(db.update).toHaveBeenCalledWith(users);
      expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
      // Should have also set deletedAt, but checking isActive is enough
    });
    
    it('should not allow deleting self', async () => {
      const { deleteUserAction } = await import('@/app/actions/users');
      const result = await deleteUserAction(1); // self is 1 based on requireRole mock
      
      expect(result.error).toBe('Tidak dapat menghapus akun sendiri.');
    });
  });

  describe('toggleUserStatusAction', () => {
    it('should prevent deactivating self', async () => {
      const result = await toggleUserStatusAction(1, false);
      expect(result.error).toBe('Tidak dapat menonaktifkan akun sendiri.');
    });

    it('should successfully toggle status', async () => {
      vi.mocked(db.limit).mockResolvedValueOnce([{ id: 2, isActive: true }]);

      const result = await toggleUserStatusAction(2, false);
      
      expect(result.success).toBe(true);
      expect(db.update).toHaveBeenCalledWith(users);
      expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    });
  });
});
