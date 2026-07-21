'use server';

import { db } from '@/lib/db';
import { competitions, grandFinalAssessments, proposals } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { eq, and, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function saveSponsorAssessmentAction(
  competitionId: number,
  proposalId: number,
  param1Score: number,
  param2Score: number,
  param3Score: number,
  param4Score: number
) {
  const session = await requireRole('sponsor');

  const totalScore = param1Score + param2Score + param3Score + param4Score;
  let classification = 'Bronze';
  if (totalScore >= 14) classification = 'Diamond';
  else if (totalScore >= 12) classification = 'Platinum';
  else if (totalScore >= 9) classification = 'Gold';
  else if (totalScore >= 7) classification = 'Silver';

  await db.insert(grandFinalAssessments)
    .values({
      competitionId,
      proposalId,
      sponsorId: session.userId,
      param1Score,
      param2Score,
      param3Score,
      param4Score,
      totalScore,
      classification
    })
    .onConflictDoUpdate({
      target: [
        grandFinalAssessments.competitionId,
        grandFinalAssessments.proposalId,
        grandFinalAssessments.sponsorId
      ],
      set: {
        param1Score,
        param2Score,
        param3Score,
        param4Score,
        totalScore,
        classification,
        updatedAt: new Date()
      }
    });

  revalidatePath('/sponsor/assess/[id]', 'page');
  revalidatePath('/sponsor/fgd');
  
  return { success: true, totalScore, classification };
}
