import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { proposals, grandFinalAssessments, users, competitions } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import Link from 'next/link';

export default async function SponsorFgdPage() {
  const session = await requireRole('sponsor');

  const [activeComp] = await db.select().from(competitions).where(eq(competitions.isActive, true)).limit(1);
  if (!activeComp) return <div className="p-8 text-gray-500">Tidak ada kompetisi aktif.</div>;

  const visibility = activeComp.sponsorScoreVisibility as 'open' | 'closed';

  // Get GF proposals
  const gfProposals = await db.select({
    id: proposals.id,
    title: proposals.title,
    category: proposals.category,
    status: proposals.status,
  }).from(proposals)
    .where(and(
      eq(proposals.competitionId, activeComp.id),
      eq(proposals.status, 'grand_final')
    ));

  // Get assessments
  let assessments: any[] = [];
  let sponsorUsers: any[] = [];

  if (visibility === 'open') {
    assessments = await db.select().from(grandFinalAssessments)
      .where(eq(grandFinalAssessments.competitionId, activeComp.id));
      
    sponsorUsers = await db.select({ id: users.id, name: users.name })
      .from(users).where(sql`'sponsor' = ANY(${users.roles})`);
  } else {
    assessments = await db.select().from(grandFinalAssessments)
      .where(and(
        eq(grandFinalAssessments.competitionId, activeComp.id),
        eq(grandFinalAssessments.sponsorId, session.userId)
      ));
    
    const [me] = await db.select({ name: users.name }).from(users).where(eq(users.id, session.userId));
    sponsorUsers = [{ id: session.userId, name: me?.name || 'Saya' }];
  }

  // Calculate my scores for sorting
  const myAssessments = assessments.filter(a => a.sponsorId === session.userId);
  const data = gfProposals.map(p => {
    const myA = myAssessments.find(a => a.proposalId === p.id);
    return {
      ...p,
      myA,
      myTotal: myA ? myA.totalScore : 0
    };
  });

  data.sort((a, b) => b.myTotal - a.myTotal);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sidang Penetapan Grand Final</h1>
          <p className="text-sm text-gray-500 mt-1">
            Status Visibilitas: <span className="font-semibold text-gray-700">{visibility === 'open' ? 'Terbuka (Dapat melihat skor sponsor lain)' : 'Tertutup (Hanya melihat skor sendiri)'}</span>
          </p>
          <div className="mt-2 bg-blue-50 text-blue-700 p-3 rounded-lg text-sm border border-blue-200">
            Halaman ini bersifat <strong>Read-Only</strong>. Proses input dan kalibrasi skor Sidang Grand Final dilakukan secara terpusat oleh Koordinator.
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">Proposal</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-indigo-600 uppercase tracking-wider bg-indigo-50 border-l border-r border-indigo-100">
                Skor Anda
              </th>
              {visibility === 'open' && sponsorUsers.filter(s => s.id !== session.userId).map(s => (
                <th key={s.id} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  {s.name.split(' ')[0]}
                </th>
              ))}
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 sticky left-0 bg-white">
                  <div className="text-sm font-medium text-gray-900 line-clamp-1" title={row.title}>{row.title}</div>
                  <div className="text-xs text-gray-500 mt-1">{row.category}</div>
                </td>
                
                {/* My Score Column */}
                <td className="px-6 py-4 text-center border-l border-r border-indigo-50 bg-indigo-50/30">
                  {row.myA ? (
                    <div>
                      <div className="text-lg font-bold text-indigo-700">{row.myA.totalScore}</div>
                      <div className="text-xs font-medium text-indigo-600 mt-0.5">{row.myA.classification}</div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>

                {/* Other Sponsors */}
                {visibility === 'open' && sponsorUsers.filter(s => s.id !== session.userId).map(s => {
                  const sA = assessments.find(a => a.proposalId === row.id && a.sponsorId === s.id);
                  return (
                    <td key={s.id} className="px-6 py-4 text-center border-r border-gray-100">
                      {sA ? (
                        <div>
                          <div className="text-sm font-bold text-gray-900">{sA.totalScore}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{sA.classification}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-300">-</span>
                      )}
                    </td>
                  );
                })}

                <td className="px-6 py-4 text-center whitespace-nowrap">
                  <span className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-gray-400 bg-gray-50 rounded-md text-xs font-medium cursor-not-allowed">
                    Terkunci
                  </span>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={10} className="px-6 py-8 text-center text-gray-500">Belum ada proposal dengan status Grand Final.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
