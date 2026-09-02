'use server';

import { db } from '@/lib/db';
import { competitions, grandFinalAssessments, proposals, users, finalResults, auditLogs, grandFinalDrawOrder } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

async function createAuditLog(
  actorId: number,
  actorName: string,
  action: string,
  entity: string,
  entityId: string,
  beforeJson: any = null,
  afterJson: any = null,
  reason: string = ''
) {
  try {
    await db.insert(auditLogs).values({
      actorId,
      actorName,
      action,
      entity,
      entityId,
      beforeJson,
      afterJson,
      reason,
      ipAddress: 'System',
    });
  } catch (e) {
    console.error('Failed to create audit log', e);
  }
}

export async function saveSponsorAssessmentAction(
  competitionId: number,
  proposalId: number,
  param1Score: number,
  param2Score: number,
  param3Score: number,
  param4Score: number,
  notes?: string
) {
  const session = await requireRole('sponsor');

  const totalScore = param1Score + param2Score + param3Score + param4Score;
  let classification = 'Bronze';
  if (totalScore >= 18) classification = 'Diamond';
  else if (totalScore >= 14) classification = 'Platinum';
  else if (totalScore >= 10) classification = 'Gold';
  else if (totalScore >= 6) classification = 'Silver';

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
      classification,
      notes: notes !== undefined ? notes : null,
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
        ...(notes !== undefined ? { notes } : {}),
        updatedAt: new Date()
      }
    });

  revalidatePath('/sponsor/assess/[id]', 'page');
  revalidatePath('/sponsor/fgd');
  revalidatePath('/sponsor');
  
  return { success: true, totalScore, classification };
}

export async function saveSponsorNotesAction(
  competitionId: number,
  proposalId: number,
  notes: string
) {
  const session = await requireRole('sponsor');

  const [existing] = await db.select().from(grandFinalAssessments)
    .where(and(
      eq(grandFinalAssessments.competitionId, competitionId),
      eq(grandFinalAssessments.proposalId, proposalId),
      eq(grandFinalAssessments.sponsorId, session.userId)
    ));

  if (existing) {
    await db.update(grandFinalAssessments)
      .set({
        notes,
        updatedAt: new Date(),
      })
      .where(eq(grandFinalAssessments.id, existing.id));
  } else {
    await db.insert(grandFinalAssessments)
      .values({
        competitionId,
        proposalId,
        sponsorId: session.userId,
        param1Score: 0,
        param2Score: 0,
        param3Score: 0,
        param4Score: 0,
        totalScore: 0,
        classification: 'Bronze',
        notes,
      });
  }

  revalidatePath('/sponsor/assess/[id]', 'page');
  revalidatePath('/sponsor/fgd');

  return { success: true };
}

export async function calibrateGrandFinalScoreAction(
  competitionId: number,
  proposalId: number,
  sponsorId: number,
  param1Score: number,
  param2Score: number,
  param3Score: number,
  param4Score: number
) {
  const session = await requireRole(['coordinator', 'admin']);
  
  const totalScore = param1Score + param2Score + param3Score + param4Score;
  let classification = 'Bronze';
  if (totalScore >= 18) classification = 'Diamond';
  else if (totalScore >= 14) classification = 'Platinum';
  else if (totalScore >= 10) classification = 'Gold';
  else if (totalScore >= 6) classification = 'Silver';

  const [existing] = await db.select()
    .from(grandFinalAssessments)
    .where(and(
      eq(grandFinalAssessments.competitionId, competitionId),
      eq(grandFinalAssessments.proposalId, proposalId),
      eq(grandFinalAssessments.sponsorId, sponsorId)
    ));

  await db.insert(grandFinalAssessments)
    .values({
      competitionId,
      proposalId,
      sponsorId,
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

  await createAuditLog(
    session.userId,
    session.name,
    'CALIBRATE_GF_SCORE',
    'grand_final_assessment',
    `${proposalId}-${sponsorId}`,
    existing || null,
    { param1Score, param2Score, param3Score, param4Score, totalScore, classification },
    `Operator mengalibrasi skor sponsor ${sponsorId} untuk proposal ${proposalId}`
  );

  revalidatePath('/coordinator/grand-final/sidang');
  return { success: true };
}

export type GrandFinalBatchAssessmentPayload = {
  sponsorId: number;
  param1Score: number;
  param2Score: number;
  param3Score: number;
  param4Score: number;
};

export async function batchCalibrateGrandFinalScoresAction(
  competitionId: number,
  proposalId: number,
  assessmentsPayload: GrandFinalBatchAssessmentPayload[]
) {
  const session = await requireRole(['coordinator', 'admin']);
  
  for (const item of assessmentsPayload) {
    const totalScore = item.param1Score + item.param2Score + item.param3Score + item.param4Score;
    let classification = 'Bronze';
    if (totalScore >= 18) classification = 'Diamond';
    else if (totalScore >= 14) classification = 'Platinum';
    else if (totalScore >= 10) classification = 'Gold';
    else if (totalScore >= 6) classification = 'Silver';

    const [existing] = await db.select()
      .from(grandFinalAssessments)
      .where(and(
        eq(grandFinalAssessments.competitionId, competitionId),
        eq(grandFinalAssessments.proposalId, proposalId),
        eq(grandFinalAssessments.sponsorId, item.sponsorId)
      ));

    await db.insert(grandFinalAssessments)
      .values({
        competitionId,
        proposalId,
        sponsorId: item.sponsorId,
        param1Score: item.param1Score,
        param2Score: item.param2Score,
        param3Score: item.param3Score,
        param4Score: item.param4Score,
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
          param1Score: item.param1Score,
          param2Score: item.param2Score,
          param3Score: item.param3Score,
          param4Score: item.param4Score,
          totalScore,
          classification,
          updatedAt: new Date()
        }
      });

    await createAuditLog(
      session.userId,
      session.name,
      'CALIBRATE_GF_SCORE',
      'grand_final_assessment',
      `${proposalId}-${item.sponsorId}`,
      existing || null,
      { ...item, totalScore, classification },
      `Operator mengalibrasi (batch) skor sponsor ${item.sponsorId} untuk proposal ${proposalId}`
    );
  }

  revalidatePath('/coordinator/grand-final/sidang');
  return { success: true };
}

export async function lockGrandFinalResultsAction(
  competitionId: number
) {
  const session = await requireRole(['coordinator', 'admin']);

  // Get active competition
  const [comp] = await db.select().from(competitions).where(eq(competitions.id, competitionId));
  if (!comp) return { error: 'Kompetisi tidak ditemukan' };

  // Get all GF proposals
  const gfProposals = await db.select().from(proposals)
    .where(and(eq(proposals.competitionId, competitionId), eq(proposals.status, 'grand_final')));

  // Get all assessments
  const assessments = await db.select().from(grandFinalAssessments).where(eq(grandFinalAssessments.competitionId, competitionId));

  // Get total distinct sponsors who voted
  const distinctSponsors = new Set(assessments.map(a => a.sponsorId));
  const sponsorCount = distinctSponsors.size || 1; // avoid div 0

  // Calculate averages
  const proposalAverages = gfProposals.map(p => {
    const pA = assessments.filter(a => a.proposalId === p.id);
    const sum = pA.reduce((acc, curr) => acc + curr.totalScore, 0);
    const avgScore = sum / sponsorCount;
    return {
      proposalId: p.id,
      category: p.category,
      avgScore
    };
  });

  const categories = ['WILAYAH', 'PUSAT', 'BI', 'BC'];

  const resultsToInsert = proposalAverages.map(p => {
    let medal = 'Bronze';
    if (p.avgScore >= 17.5) medal = 'Diamond';
    else if (p.avgScore >= 13.5) medal = 'Platinum';
    else if (p.avgScore >= 9.5) medal = 'Gold';
    else if (p.avgScore >= 5.5) medal = 'Silver';
    
    return {
      competitionId,
      proposalId: p.proposalId,
      resultStatus: medal,
      notes: null,
      lockedAt: new Date(),
      lockedBy: session.userId
    };
  });

  // Calculate rank per category (proposals with same score share the same rank)
  for (const cat of categories) {
    const pCat = resultsToInsert.filter(p => proposalAverages.find(a => a.proposalId === p.proposalId)?.category === cat);
    pCat.sort((a, b) => {
      const aAvg = proposalAverages.find(p => p.proposalId === a.proposalId)!.avgScore;
      const bAvg = proposalAverages.find(p => p.proposalId === b.proposalId)!.avgScore;
      return bAvg - aAvg;
    });
    
    let currentRank = 1;
    pCat.forEach((r, idx) => {
      if (idx > 0) {
        const prevAvg = proposalAverages.find(p => p.proposalId === pCat[idx - 1].proposalId)!.avgScore;
        const curAvg = proposalAverages.find(p => p.proposalId === r.proposalId)!.avgScore;
        if (curAvg < prevAvg) {
          currentRank = idx + 1;
        }
      }
      (r as any).rank = currentRank;
    });
  }

  // Delete existing
  await db.delete(finalResults).where(eq(finalResults.competitionId, competitionId));

  // Insert
  await db.insert(finalResults).values(resultsToInsert as any[]);

  await createAuditLog(
    session.userId,
    session.name,
    'LOCK_GRAND_FINAL',
    'competitions',
    competitionId.toString(),
    null,
    { count: resultsToInsert.length },
    'Mengunci hasil sidang penetapan Grand Final'
  );

  revalidatePath('/coordinator/grand-final/sidang');
  revalidatePath('/coordinator/grand-final/hasil');
  return { success: true };
}

export async function unlockGrandFinalResultsAction(
  competitionId: number
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['coordinator', 'admin']);

  await db.delete(finalResults).where(eq(finalResults.competitionId, competitionId));

  await createAuditLog(
    session.userId,
    session.name,
    'UNLOCK_GRAND_FINAL',
    'competitions',
    competitionId.toString(),
    null,
    {},
    'Membuka kunci hasil sidang penetapan Grand Final untuk revisi'
  );

  revalidatePath('/coordinator/grand-final/sidang');
  revalidatePath('/coordinator/grand-final/hasil');
  return { success: true };
}

// ─── GRAND FINAL DRAW ORDERS ──────────────────────────────────────────────────
export async function getGrandFinalDrawOrders(competitionId: number) {
  await requireRole(['coordinator', 'admin', 'viewer', 'sponsor']);
  return db
    .select()
    .from(grandFinalDrawOrder)
    .where(eq(grandFinalDrawOrder.competitionId, competitionId));
}

export async function setGrandFinalDrawOrdersAction(
  competitionId: number,
  orders: { proposalId: number; sortOrder: number | null }[]
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['coordinator', 'admin']);

  // Validasi duplicate numbers (kecuali null)
  const nonNullOrders = orders.filter(o => o.sortOrder !== null && o.sortOrder !== undefined);
  const orderNums = nonNullOrders.map(o => o.sortOrder as number);
  const uniqueNums = new Set(orderNums);
  if (orderNums.length !== uniqueNums.size) {
    return { success: false, error: 'Terdapat nomor undian duplikat. Setiap nomor harus unik.' };
  }

  // Validasi: semua proposalId harus valid dan berstatus grand_final di kompetisi ini
  if (orders.length > 0) {
    const proposalIds = orders.map(o => o.proposalId);
    const validProposals = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(
        and(
          eq(proposals.competitionId, competitionId),
          eq(proposals.status, 'grand_final'),
          inArray(proposals.id, proposalIds)
        )
      );
    if (validProposals.length !== proposalIds.length) {
      return { success: false, error: 'Beberapa proposal tidak valid untuk kompetisi ini.' };
    }
  }

  // Hapus semua draw order lama untuk kompetisi ini
  await db
    .delete(grandFinalDrawOrder)
    .where(eq(grandFinalDrawOrder.competitionId, competitionId));

  // Insert yang baru (hanya yang memiliki sortOrder valid)
  const valuesToInsert = nonNullOrders.map(o => ({
    competitionId,
    proposalId: o.proposalId,
    sortOrder: o.sortOrder,
    updatedAt: new Date(),
  }));

  if (valuesToInsert.length > 0) {
    await db.insert(grandFinalDrawOrder).values(valuesToInsert);
  }

  await createAuditLog(
    session.userId,
    session.name,
    'SET_GRAND_FINAL_DRAW_ORDER',
    'competitions',
    competitionId.toString(),
    null,
    { count: valuesToInsert.length },
    'Mengatur nomor undian Grand Final'
  );

  revalidatePath('/coordinator/grand-final/kelola');
  revalidatePath('/sponsor');
  revalidatePath('/sponsor/assess');
  return { success: true };
}

