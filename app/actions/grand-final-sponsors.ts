'use server';

import { db } from '@/lib/db';
import { grandFinalSponsors, users } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { eq, and, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getGrandFinalSponsors(competitionId: number) {
  await requireRole(['coordinator', 'admin', 'viewer']);

  return db
    .select({
      id: grandFinalSponsors.id,
      competitionId: grandFinalSponsors.competitionId,
      userId: grandFinalSponsors.userId,
      assignedBy: grandFinalSponsors.assignedBy,
      assignedAt: grandFinalSponsors.assignedAt,
      user: {
        name: users.name,
      }
    })
    .from(grandFinalSponsors)
    .innerJoin(users, eq(users.id, grandFinalSponsors.userId))
    .where(eq(grandFinalSponsors.competitionId, competitionId));
}

export async function assignGrandFinalSponsorsAction(competitionId: number, sponsorIds: number[]) {
  const session = await requireRole('coordinator');

  // Hapus assignment yang lama untuk kompetisi ini
  await db.delete(grandFinalSponsors).where(eq(grandFinalSponsors.competitionId, competitionId));

  // Insert yang baru
  if (sponsorIds.length > 0) {
    const values = sponsorIds.map(userId => ({
      competitionId,
      userId,
      assignedBy: session.userId,
    }));
    await db.insert(grandFinalSponsors).values(values);
  }

  revalidatePath('/coordinator/grand-final/kelola');
  revalidatePath('/coordinator/grand-final/setup');
  revalidatePath('/sponsor');
  
  return { success: true };
}
