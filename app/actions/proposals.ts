'use server';

import { db } from '@/lib/db';
import { proposals, competitions } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { eq, and, inArray, count, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit } from '@/lib/audit';

const PROPOSAL_CATEGORIES = ['WILAYAH', 'PUSAT', 'BI', 'BC'] as const;
type ProposalCategory = (typeof PROPOSAL_CATEGORIES)[number];

const proposalRowSchema = z.object({
  externalId: z.string().optional(),
  title: z.string().min(1),
  proposerName: z.string().min(1),
  proposerOrg: z.string().optional(),
  proposerEmail: z.string().email().optional().or(z.literal('')),
  category: z.enum(PROPOSAL_CATEGORIES),
  division: z.string().optional(),
  regionCenter: z.string().optional(),
  summary: z.string().optional(),
});

type ImportActionState = {
  success?: boolean;
  error?: string;
  imported?: number;
  skipped?: number;
};

/**
 * Import proposals from JSON array (parsed from CSV/JSON upload).
 * Deduplicates by externalId if provided.
 */
export async function importProposalsAction(
  competitionId: number,
  rawData: unknown[]
): Promise<ImportActionState> {
  const session = await requireRole('coordinator');

  // Verify competition exists and is in 'imported' phase
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);

  if (!competition) return { error: 'Kompetisi tidak ditemukan' };

  let imported = 0;
  let skipped = 0;

  for (const row of rawData) {
    const parsed = proposalRowSchema.safeParse(row);
    if (!parsed.success) {
      skipped++;
      continue;
    }

    const data = parsed.data;

    // Check for duplicate externalId
    if (data.externalId) {
      const existing = await db
        .select({ id: proposals.id })
        .from(proposals)
        .where(
          and(
            eq(proposals.competitionId, competitionId),
            eq(proposals.externalId, data.externalId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }
    }

    await db.insert(proposals).values({
      competitionId,
      externalId: data.externalId ?? null,
      title: data.title,
      proposerName: data.proposerName,
      proposerOrg: data.proposerOrg ?? null,
      proposerEmail: data.proposerEmail ?? null,
      category: data.category,
      division: data.division ?? null,
      regionCenter: data.regionCenter ?? null,
      summary: data.summary ?? null,
      status: 'imported',
      importedBy: session.userId,
    });

    imported++;
  }

  if (imported > 0) {
    // Re-calculate nomor_urut for all proposals in this competition to ensure consistency
    await db.execute(sql`
      UPDATE proposals p
      SET nomor_urut = sub.rn
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY category, region_center ORDER BY id ASC) as rn
        FROM proposals
        WHERE competition_id = ${competitionId}
      ) sub
      WHERE p.id = sub.id;
    `);
  }

  await audit.importProposals(competitionId, imported);
  revalidatePath('/overview');

  return { success: true, imported, skipped };
}

export async function getProposalsByCompetition(competitionId: number) {
  return db
    .select()
    .from(proposals)
    .where(eq(proposals.competitionId, competitionId));
}

export async function getProposalsWithRowNumber(competitionId: number) {
  // Use the pre-computed nomor_urut instead of on-the-fly window function
  const result = await db.execute(sql`
    SELECT p.*, p.nomor_urut as row_number
    FROM proposals p
    WHERE p.competition_id = ${competitionId}
    ORDER BY p.id ASC
  `);
  
  // Transform db.execute raw result keys from snake_case to camelCase
  // or return as is and handle on UI. We will type-cast for now.
  return result as unknown as any[];
}

export async function getProposalCountByCategory(competitionId: number) {
  const result = await db
    .select({ category: proposals.category, count: count() })
    .from(proposals)
    .where(eq(proposals.competitionId, competitionId))
    .groupBy(proposals.category);
  return result;
}

export async function getProposalsByStatus(competitionId: number, status: string) {
  return db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.competitionId, competitionId),
        eq(proposals.status, status)
      )
    );
}

export async function getProposalById(id: number) {
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  return proposal ?? null;
}

export async function updateProposalStatus(
  proposalId: number,
  status: string,
  takeoutReason?: string
) {
  const before = await getProposalById(proposalId);
  await db
    .update(proposals)
    .set({
      status,
      takeoutReason: takeoutReason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(proposals.id, proposalId));
  return before;
}

export async function bulkUpdateProposalStatus(
  proposalIds: number[],
  status: string,
  takeoutReason?: string
) {
  if (proposalIds.length === 0) return;
  await db
    .update(proposals)
    .set({
      status,
      takeoutReason: takeoutReason ?? null,
      updatedAt: new Date(),
    })
    .where(inArray(proposals.id, proposalIds));
}
