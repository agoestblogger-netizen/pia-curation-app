'use server';

import { db } from '@/lib/db';
import { competitions, proposals } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { eq, desc, count } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit } from '@/lib/audit';

const competitionSchema = z.object({
  name: z.string().min(1, 'Nama kompetisi wajib diisi'),
  year: z.coerce.number().min(2000).max(2100),
  description: z.string().optional(),
});

const PHASE_ORDER = [
  'imported',
  'curation',
  'promotor_selection',
  'nomination_filter',
  'grand_final',
  'sponsor_scoring',
  'finalization',
  'closed',
] as const;

type CompetitionPhase = (typeof PHASE_ORDER)[number];

type CompetitionActionState = {
  success?: boolean;
  error?: string;
};

export async function createCompetitionAction(
  _prev: CompetitionActionState,
  formData: FormData
): Promise<CompetitionActionState> {
  const session = await requireRole('coordinator');

  const parsed = competitionSchema.safeParse({
    name: formData.get('name'),
    year: formData.get('year'),
    description: formData.get('description'),
  });

  if (!parsed.success) {
    return { error: (parsed.error as any).errors[0]?.message ?? 'Data tidak valid' };
  }

  await db.insert(competitions).values({
    ...parsed.data,
    createdBy: session.userId,
  });

  revalidatePath('/overview');
  return { success: true };
}

export async function advancePhaseAction(
  competitionId: number,
  overrideReason?: string
): Promise<CompetitionActionState> {
  const session = await requireRole('coordinator');

  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);

  if (!competition) return { error: 'Kompetisi tidak ditemukan' };

  const currentIndex = PHASE_ORDER.indexOf(competition.phase as CompetitionPhase);
  if (currentIndex === -1 || currentIndex >= PHASE_ORDER.length - 1) {
    return { error: 'Kompetisi sudah berada di tahap akhir' };
  }

  const nextPhase = PHASE_ORDER[currentIndex + 1];

  await db
    .update(competitions)
    .set({
      phase: nextPhase,
      phaseLockedAt: new Date(),
      phaseLockedBy: session.userId,
      updatedAt: new Date(),
    })
    .where(eq(competitions.id, competitionId));

  await audit.closePhase(competitionId, nextPhase, overrideReason);
  revalidatePath('/overview');
  return { success: true };
}

export async function getActiveCompetition() {
  const [comp] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.isActive, true))
    .limit(1);
  return comp ?? null;
}

export async function getAllCompetitions() {
  return db.select().from(competitions).orderBy(desc(competitions.year));
}

export async function getProposalCountByCategory(competitionId: number) {
  const result = await db
    .select({
      category: proposals.category,
      count: count(),
    })
    .from(proposals)
    .where(eq(proposals.competitionId, competitionId))
    .groupBy(proposals.category);
  
  return result;
}


