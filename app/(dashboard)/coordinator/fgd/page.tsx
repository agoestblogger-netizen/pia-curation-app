import { db } from '@/lib/db';
import { fgdSessions, competitions } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getActiveCompetition } from '@/app/actions/competitions';
import { getSession } from '@/lib/auth/session';
import Link from 'next/link';
import FgdListClient from './FgdListClient';

export default async function FgdPage() {
  const session = await getSession();
  if (!session || !session.roles.some(r => ['coordinator', 'curator', 'promoter', 'viewer', 'admin'].includes(r))) {
    return <div>Unauthorized</div>;
  }
  
  const isCoordinator = session.roles.includes('coordinator') || session.roles.includes('admin');

  const activeComp = await getActiveCompetition();
  if (!activeComp) {
    return <div className="p-8">Belum ada kompetisi aktif.</div>;
  }

  const sessions = await db
    .select()
    .from(fgdSessions)
    .where(eq(fgdSessions.competitionId, activeComp.id))
    .orderBy(desc(fgdSessions.createdAt));

  // Sync regional FGD sessions status with Menu Regional lock state
  const { proposals } = await import('@/lib/db/schema');
  const { and, sql } = await import('drizzle-orm');

  for (const s of sessions) {
    if (s.scope === 'regional' && s.status === 'locked' && s.regionCenter) {
      const isKanpus = s.regionCenter === 'Kantor Pusat';
      const [finalizedCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(proposals)
        .where(
          and(
            eq(proposals.competitionId, activeComp.id),
            isKanpus
              ? eq(proposals.category, 'PUSAT')
              : and(eq(proposals.category, 'WILAYAH'), eq(proposals.regionCenter, s.regionCenter)),
            sql`regional_finalized_at IS NOT NULL`
          )
        );

      if (Number(finalizedCount?.count || 0) === 0) {
        // Group lock opened in Menu Regional -> sync fgd_sessions.status back to active
        await db.update(fgdSessions)
          .set({ status: 'active', lockedAt: null, lockedBy: null, updatedAt: new Date() })
          .where(eq(fgdSessions.id, s.id));
        s.status = 'active';
        s.lockedAt = null;
        s.lockedBy = null;
      }
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">


      <FgdListClient sessions={sessions} isCoordinator={isCoordinator} roles={session.roles} />
    </div>
  );
}
