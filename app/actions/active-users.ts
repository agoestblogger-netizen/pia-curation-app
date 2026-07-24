'use server';

import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { gte, and, eq, desc, isNotNull } from 'drizzle-orm';

export interface ActiveUserDTO {
  id: number;
  name: string;
  email: string;
  roles: string[];
  lastActiveAt: string | null;
  secondsAgo: number | null;
}

export async function getActiveUsersAction() {
  await requireRole('admin');

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  // Fetch users active within last 5 minutes
  const activeUsersData = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      roles: users.roles,
      lastActiveAt: users.lastActiveAt,
    })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        isNotNull(users.lastActiveAt),
        gte(users.lastActiveAt, fiveMinutesAgo)
      )
    )
    .orderBy(desc(users.lastActiveAt));

  const nowMs = Date.now();

  const activeUsers: ActiveUserDTO[] = activeUsersData.map((u) => {
    const timeMs = u.lastActiveAt ? new Date(u.lastActiveAt).getTime() : 0;
    const secondsAgo = timeMs ? Math.max(0, Math.floor((nowMs - timeMs) / 1000)) : null;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      roles: u.roles || [],
      lastActiveAt: u.lastActiveAt ? u.lastActiveAt.toISOString() : null,
      secondsAgo,
    };
  });

  return {
    success: true,
    activeCount: activeUsers.length,
    users: activeUsers,
    fetchedAt: new Date().toISOString(),
  };
}
