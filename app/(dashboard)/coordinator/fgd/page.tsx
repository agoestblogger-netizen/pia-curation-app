import { db } from '@/lib/db';
import { fgdSessions, competitions } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getActiveCompetition } from '@/app/actions/competitions';
import { getSession } from '@/lib/auth/session';
import Link from 'next/link';
import FgdListClient from './FgdListClient';

export default async function FgdPage() {
  const session = await getSession();
  if (!session || !session.roles.some(r => ['coordinator', 'curator', 'promoter'].includes(r))) {
    return <div>Unauthorized</div>;
  }
  
  const isCoordinator = session.roles.includes('coordinator');

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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sesi FGD (Kurator & Promotor)</h1>
          <p className="text-gray-600">Kelola sesi Focus Group Discussion (FGD) untuk penetapan proposal.</p>
        </div>
        {isCoordinator && (
          <Link 
            href="/coordinator/fgd/new"
            className="bg-teal-600 text-white px-4 py-2 rounded font-medium hover:bg-teal-700 transition"
          >
            + Buat Sesi Baru
          </Link>
        )}
      </div>

      <FgdListClient sessions={sessions} isCoordinator={isCoordinator} />
    </div>
  );
}
