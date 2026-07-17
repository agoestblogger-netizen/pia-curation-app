'use server';

import { db } from '@/lib/db';
import { regionalLeads } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/helpers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const assignLeadSchema = z.object({
  regionCenter: z.string().min(1),
  curatorId: z.coerce.number(),
});

type ActionState = {
  success?: boolean;
  error?: string;
};

export async function assignRegionalLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireRole('coordinator');
  
  const parsed = assignLeadSchema.safeParse({
    regionCenter: formData.get('regionCenter'),
    curatorId: formData.get('curatorId'),
  });

  if (!parsed.success) return { error: 'Data tidak valid' };
  
  const { regionCenter, curatorId } = parsed.data;

  // Insert or Update the regional lead for this regionCenter
  await db.insert(regionalLeads).values({
    regionCenter,
    curatorId,
    assignedBy: session.userId,
  }).onConflictDoUpdate({
    target: [regionalLeads.regionCenter],
    set: {
      curatorId,
      assignedBy: session.userId,
      assignedAt: new Date(),
    }
  });

  revalidatePath('/coordinator/regional-leads');
  return { success: true };
}
