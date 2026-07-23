'use server';

import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { eq, and, isNull, ne, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createAuditLog, audit } from '@/lib/audit';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  roles: z.array(z.enum(['admin', 'coordinator', 'curator', 'promoter', 'sponsor', 'viewer', 'regional'])).min(1, 'Pilih minimal satu role'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
});

type CreateUserState = {
  success?: boolean;
  error?: string;
  userId?: number;
  generatedPassword?: string;
};

export async function createUserAction(
  _prev: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const session = await requireRole('coordinator');

  const parsed = createUserSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    roles: formData.getAll('roles'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' };
  }

  const { name, email, roles, password } = parsed.data;

  // Check duplicate email
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return { error: 'Email sudah digunakan.' };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [newUser] = await db.insert(users).values({
    name,
    email,
    passwordHash,
    roles,
    isActive: true,
  }).returning();

  await createAuditLog({
    action: 'user_created',
    entity: 'user',
    entityId: newUser.id,
    after: { name, email, roles },
  });

  revalidatePath('/coordinator/users');
  return { success: true, userId: newUser.id };
}

type ToggleUserState = {
  success?: boolean;
  error?: string;
};

export async function toggleUserStatusAction(
  userId: number,
  isActive: boolean
): Promise<ToggleUserState> {
  const session = await requireRole('coordinator');

  // Cannot deactivate self
  if (userId === session.userId) {
    return { error: 'Tidak dapat menonaktifkan akun sendiri.' };
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { error: 'User tidak ditemukan.' };

  await db.update(users).set({
    isActive,
    updatedAt: new Date(),
  }).where(eq(users.id, userId));

  await createAuditLog({
    action: isActive ? 'user_activated' : 'user_deactivated',
    entity: 'user',
    entityId: userId,
    before: { isActive: !isActive },
    after: { isActive },
  });

  revalidatePath('/coordinator/users');
  return { success: true };
}

export async function listUsersAction() {
  await requireRole('coordinator');
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    roles: users.roles,
    isActive: users.isActive,
    createdAt: users.createdAt,
  }).from(users)
    .where(isNull(users.deletedAt))
    .orderBy(users.name);
}

const editUserSchema = z.object({
  userId: z.coerce.number(),
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  roles: z.array(z.enum(['admin', 'coordinator', 'curator', 'promoter', 'sponsor', 'viewer', 'regional'])).min(1, 'Pilih minimal satu role'),
  isActive: z.boolean(),
  password: z.string().optional(),
});

export async function updateUserAction(
  _prev: any,
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const session = await requireRole('coordinator');

  const parsed = editUserSchema.safeParse({
    userId: formData.get('userId'),
    name: formData.get('name'),
    email: formData.get('email'),
    roles: formData.getAll('roles'),
    isActive: formData.get('isActive') === 'true',
    password: formData.get('password') || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' };
  }

  const { userId, name, email, roles, isActive, password } = parsed.data;

  // Cek apakah user eksis dan belum dihapus
  const [existingUser] = await db.select().from(users).where(and(eq(users.id, userId), isNull(users.deletedAt))).limit(1);
  if (!existingUser) {
    return { error: 'User tidak ditemukan.' };
  }

  // Cek email duplikat (kecuali punya user ini sendiri)
  const [duplicateEmail] = await db.select().from(users).where(and(eq(users.email, email), ne(users.id, userId))).limit(1);
  if (duplicateEmail) {
    return { error: 'Email sudah digunakan oleh user lain.' };
  }

  const updateData: any = {
    name,
    email,
    roles,
    isActive,
    updatedAt: new Date(),
  };

  if (password && password.length > 0) {
    updateData.passwordHash = await bcrypt.hash(password, 10);
  }

  // Update
  await db.update(users).set(updateData).where(eq(users.id, userId));

  await audit.userEdited(userId, { 
    name: existingUser.name, 
    email: existingUser.email, 
    roles: existingUser.roles, 
    isActive: existingUser.isActive 
  }, { name, email, roles, isActive });

  if (password && password.length > 0) {
    await audit.passwordResetByAdmin(userId);
  }

  revalidatePath('/coordinator/users');
  return { success: true };
}

export async function deleteUserAction(
  userId: number
): Promise<{ success?: boolean; error?: string }> {
  const session = await requireRole('coordinator');

  if (userId === session.userId) {
    return { error: 'Tidak dapat menghapus akun sendiri.' };
  }

  const [existingUser] = await db.select().from(users).where(and(eq(users.id, userId), isNull(users.deletedAt))).limit(1);
  if (!existingUser) {
    return { error: 'User tidak ditemukan.' };
  }

  await db.update(users).set({
    isActive: false,
    email: sql`${users.email} || '_deleted_' || ${Date.now()}`,
    deletedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(users.id, userId));

  await audit.userDeleted(userId);

  revalidatePath('/coordinator/users');
  return { success: true };
}
