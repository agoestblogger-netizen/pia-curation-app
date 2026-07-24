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
  await requireRole(['coordinator', 'admin']);

  const sponsorScoreVisibility = formData.get('sponsorScoreVisibility') as 'open' | 'closed' | null;
  const regionalCuratorMode = formData.get('regionalCuratorMode') as 'single' | 'multiple' | null;
  const showGugurRaw = formData.get('showGugurProposals');
  const showGugurProposals = showGugurRaw !== null ? showGugurRaw === 'true' || showGugurRaw === 'on' : null;

  const updateData: Record<string, any> = { updatedAt: new Date() };

  if (sponsorScoreVisibility) {
    if (!['open', 'closed'].includes(sponsorScoreVisibility)) {
      return { error: 'Invalid sponsorScoreVisibility' };
    }
    updateData.sponsorScoreVisibility = sponsorScoreVisibility;
  }

  if (regionalCuratorMode) {
    if (!['single', 'multiple'].includes(regionalCuratorMode)) {
      return { error: 'Invalid regionalCuratorMode' };
    }
    updateData.regionalCuratorMode = regionalCuratorMode;
  }

  if (showGugurProposals !== null) {
    updateData.showGugurProposals = showGugurProposals;
  }

  await db.update(competitions)
    .set(updateData)
    .where(eq(competitions.id, competitionId));

  revalidatePath('/coordinator/settings');
  revalidatePath('/coordinator/proposals');
  revalidatePath('/coordinator/batches');
  revalidatePath('/sponsor/fgd');
  
  return { success: true };
}
