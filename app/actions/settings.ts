'use server';

import { db } from '@/lib/db';
import { competitions } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function updateCompetitionSettingsAction(
  competitionId: number,
  formData: FormData
) {
  await requireRole('admin'); // Only admin can access this

  const sponsorScoreVisibility = formData.get('sponsorScoreVisibility') as 'open' | 'closed';

  if (!['open', 'closed'].includes(sponsorScoreVisibility)) {
    return { error: 'Invalid sponsorScoreVisibility' };
  }

  await db.update(competitions)
    .set({ sponsorScoreVisibility })
    .where(eq(competitions.id, competitionId));

  revalidatePath('/admin/settings');
  revalidatePath('/sponsor/fgd');
  
  return { success: true };
}
