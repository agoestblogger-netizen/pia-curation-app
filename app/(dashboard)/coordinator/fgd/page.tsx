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

  return (
    <div className="p-8 max-w-6xl mx-auto">


      <FgdListClient sessions={sessions} isCoordinator={isCoordinator} roles={session.roles} />
    </div>
  );
}
