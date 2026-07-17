import { getActiveCompetition } from '@/app/actions/competitions';
import { db } from '@/lib/db';
import { proposals, promoterSelections, users } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export default async function PromoterTab() {
  const activeComp = await getActiveCompetition();

  if (!activeComp) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-bold mb-4">Pemilihan Promotor</h2>
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md">
          Belum ada kompetisi aktif.
        </div>
      </div>
    );
  }

  // Fetch passed proposals
  const passedProposals = await db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.competitionId, activeComp.id),
        inArray(proposals.status, ['curation_passed', 'promotor_nominated'])
      )
    )
    .orderBy(proposals.id);

  // Fetch all promoter selections for these proposals
  const selections = await db
    .select({
      proposalId: promoterSelections.proposalId,
      promoterName: users.name,
    })
    .from(promoterSelections)
    .leftJoin(users, eq(users.id, promoterSelections.promoterId))
    .where(eq(promoterSelections.competitionId, activeComp.id));

  // Group selections by proposalId
  const selectionsByProposal: Record<number, string[]> = {};
  for (const s of selections) {
    if (!selectionsByProposal[s.proposalId]) {
      selectionsByProposal[s.proposalId] = [];
    }
    if (s.promoterName) {
      selectionsByProposal[s.proposalId].push(s.promoterName);
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-900">Monitoring Pemilihan Promotor</h2>
      <p className="text-gray-600 mb-6">
        Berikut adalah daftar proposal yang telah lolos tahap screening (BI & BC). Anda dapat melihat promotor mana saja yang telah memilih proposal tersebut.
      </p>

      {passedProposals.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 text-gray-500 rounded p-6 text-center">
          Belum ada proposal yang lolos kurasi (status curation_passed)
        </div>
      ) : (
        <div className="bg-white rounded shadow overflow-x-auto border border-gray-200">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-6 py-3 font-semibold border-b">ID / Kategori</th>
                <th className="px-6 py-3 font-semibold border-b">Judul & Pengusul</th>
                <th className="px-6 py-3 font-semibold border-b">Promotor yang Memilih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {passedProposals.map((p) => {
                const selectedBy = selectionsByProposal[p.id] || [];
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">#{p.id}</div>
                      <div className="text-xs text-indigo-600 font-semibold mt-1">{p.category}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{p.title}</div>
                      <div className="text-xs text-gray-500 mt-1">{p.proposerName} - {p.proposerOrg || p.proposerRegion}</div>
                    </td>
                    <td className="px-6 py-4">
                      {selectedBy.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {selectedBy.map((name, i) => (
                            <span key={i} className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-xs">Belum ada yang memilih</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
