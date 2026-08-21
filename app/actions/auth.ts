'use server';

import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createSession, setSessionCookie, clearSessionCookie, getSession } from '@/lib/auth/session';
import bcrypt from 'bcrypt';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type LoginState = {
  error?: string;
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: 'Email atau password tidak valid.' };
  }

  const { email, password } = parsed.data;

  let user = null;
  try {
    const [foundUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    user = foundUser;
  } catch (err) {
    console.error('[loginAction] Database query error for email:', email, err);
    return { error: 'Terjadi kendala koneksi basis data. Silakan coba lagi.' };
  }

  if (!user || !user.isActive) {
    return { error: 'Akun tidak ditemukan atau tidak aktif.' };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: 'Password salah.' };
  }

  const token = await createSession({
    userId: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles,
    mustChangePassword: Boolean(user.mustChangePassword),
  });

  await setSessionCookie(token);

  if (user.roles.includes('regional') && user.mustChangePassword) {
    redirect('/settings/password');
  }

  if (user.roles.includes('coordinator')) {
    redirect('/overview');
  } else if (user.roles.includes('curator')) {
    redirect('/overview');
  } else if (user.roles.includes('promoter')) {
    redirect('/promoter');
  } else if (user.roles.includes('sponsor')) {
    redirect('/sponsor');
  } else if (user.roles.includes('regional')) {
    redirect('/regional-dashboard');
  } else if (user.roles.includes('viewer')) {
    redirect('/overview');
  } else {
    redirect('/');
  }
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect('/login');
}

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Password lama harus diisi'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter'),
});

type ChangePasswordState = {
  success?: boolean;
  error?: string;
};

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Sesi tidak valid. Silakan login kembali.' };
  }

  const parsed = changePasswordSchema.safeParse({
    oldPassword: formData.get('oldPassword'),
    newPassword: formData.get('newPassword'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' };
  }

  const { oldPassword, newPassword } = parsed.data;
  
  if (newPassword.toLowerCase() === 'gadai123') {
    return { error: 'Password baru tidak boleh menggunakan password default (gadai123).' };
  }

  if (formData.get('confirmPassword') !== newPassword) {
    return { error: 'Konfirmasi password baru tidak cocok.' };
  }

  let user = null;
  try {
    const [foundUser] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    user = foundUser;
  } catch (err) {
    console.error('[changePasswordAction] Database query error for userId:', session.userId, err);
    return { error: 'Terjadi kendala koneksi basis data. Silakan coba lagi.' };
  }

  if (!user) return { error: 'User tidak ditemukan.' };

  const valid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!valid) {
    return { error: 'Password lama salah.' };
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  try {
    await db.update(users).set({
      passwordHash: newHash,
      mustChangePassword: false,
      updatedAt: new Date(),
    }).where(eq(users.id, session.userId));
  } catch (err) {
    console.error('[changePasswordAction] Database update error:', err);
    return { error: 'Gagal memperbarui password pada basis data. Silakan coba lagi.' };
  }

  // Update session cookie with mustChangePassword = false
  const updatedToken = await createSession({
    userId: session.userId,
    name: session.name,
    email: session.email,
    roles: session.roles,
    mustChangePassword: false,
  });
  await setSessionCookie(updatedToken);

  const { createAuditLog } = await import('@/lib/audit');
  await createAuditLog({
    action: 'password_changed',
    entity: 'user',
    entityId: session.userId,
  });

  return { success: true };
}
