import { getActiveCompetition, advancePhaseAction } from '@/app/actions/competitions';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { proposals, curatorAssignments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';

export default async function OverviewDashboard() {
  const session = await getSession();
  const activeComp = await getActiveCompetition();

  if (!activeComp) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md">
          Belum ada kompetisi aktif.
        </div>
      </div>
    );
  }

  // Fetch all proposals for this competition
  const allProposals = await db
    .select({
      id: proposals.id,
      category: proposals.category,
      regionCenter: proposals.regionCenter,
      status: proposals.status
    })
    .from(proposals)
    .where(eq(proposals.competitionId, activeComp.id));

  // Fetch all completed curator assignments
  const completedAssignments = await db
    .select({
      proposalId: curatorAssignments.proposalId
    })
    .from(curatorAssignments)
    .where(eq(curatorAssignments.status, 'completed'));

  const completedProposalIds = new Set(completedAssignments.map(a => a.proposalId));

  // Calculate Stats
  const totalDiimpor = allProposals.length;
  let totalTerkurasi = 0;

  const catTotal: Record<string, number> = { WILAYAH: 0, PUSAT: 0, BI: 0, BC: 0 };
  const catCurated: Record<string, number> = { WILAYAH: 0, PUSAT: 0, BI: 0, BC: 0 };
  
  const wilTotal: Record<string, number> = {};
  const wilCurated: Record<string, number> = {};

  allProposals.forEach(p => {
    const isCurated = completedProposalIds.has(p.id);
    if (isCurated) totalTerkurasi++;

    // Kategori
    if (p.category in catTotal) {
      catTotal[p.category]++;
      if (isCurated) catCurated[p.category]++;
    }

    // Wilayah & Pusat (combine for specific table)
    if (p.category === 'WILAYAH' && p.regionCenter) {
      const city = `Kanwil ${p.regionCenter}`;
      wilTotal[city] = (wilTotal[city] || 0) + 1;
      if (isCurated) wilCurated[city] = (wilCurated[city] || 0) + 1;
    } else if (p.category === 'PUSAT') {
      const label = 'Kantor Pusat';
      wilTotal[label] = (wilTotal[label] || 0) + 1;
      if (isCurated) wilCurated[label] = (wilCurated[label] || 0) + 1;
    }
  });

  // Sort Kanwil/Pusat alphabetically, but put Kantor Pusat at the end
  const sortedWilayahKeys = Object.keys(wilTotal).sort((a, b) => {
    if (a === 'Kantor Pusat') return 1;
    if (b === 'Kantor Pusat') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{activeComp.name} &middot; Tahap: <span className="font-semibold capitalize">{activeComp.phase}</span></p>
        </div>
        
        {session?.roles?.includes('coordinator') && (
          <div className="flex space-x-3">
            <a
              href="/api/pdf/proposals"
              target="_blank"
              className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-xl hover:bg-indigo-50"
            >
              Export PDF
            </a>
            <Link href="/coordinator/proposals" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700">
              Semua Proposal &rarr;
            </Link>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="text-sm text-gray-500 font-medium mb-1">Total Proposal</div>
          <div className="text-3xl font-bold text-gray-900">{totalDiimpor.toLocaleString('id-ID')}</div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="text-sm text-gray-500 font-medium mb-1">Total Terkurasi</div>
          <div className="text-3xl font-bold text-indigo-600">{totalTerkurasi.toLocaleString('id-ID')}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Category Breakdown (Fixed) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Distribusi Kategori</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-100 flex-1">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kategori</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {['WILAYAH', 'PUSAT', 'BC', 'BI'].map((cat) => (
                <tr key={cat}>
                  <td className="px-5 py-3 font-semibold text-sm text-gray-900">{cat}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{catTotal[cat]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Category Breakdown (Progress) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 bg-indigo-50/30">
            <h2 className="font-bold text-indigo-900">Progress Terkurasi per Kategori</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-100 flex-1">
            <thead className="bg-indigo-50/50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-indigo-800 uppercase">Kategori</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-indigo-800 uppercase">Terkurasi / Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {['WILAYAH', 'PUSAT', 'BC', 'BI'].map((cat) => (
                <tr key={cat}>
                  <td className="px-5 py-3 font-semibold text-sm text-gray-900">{cat}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-indigo-700">
                    {catCurated[cat]} / <span className="text-gray-500 font-normal">{catTotal[cat]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Region Breakdown (Fixed) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Distribusi per Kanwil/Pusat</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-100 flex-1">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Wilayah</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedWilayahKeys.map((key) => (
                <tr key={key}>
                  <td className="px-5 py-3 font-semibold text-sm text-gray-900">{key}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{wilTotal[key]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Region Breakdown (Progress) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 bg-indigo-50/30">
            <h2 className="font-bold text-indigo-900">Progress Terkurasi per Kanwil/Pusat</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-100 flex-1">
            <thead className="bg-indigo-50/50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-indigo-800 uppercase">Wilayah</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-indigo-800 uppercase">Terkurasi / Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedWilayahKeys.map((key) => (
                <tr key={key}>
                  <td className="px-5 py-3 font-semibold text-sm text-gray-900">{key}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-indigo-700">
                    {wilCurated[key] || 0} / <span className="text-gray-500 font-normal">{wilTotal[key]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {session?.roles?.includes('coordinator') && (
        <div className="mt-8 bg-indigo-50 p-6 rounded-xl border border-indigo-100">
          <h3 className="text-lg font-bold text-indigo-900 mb-2">Administrasi Tahap Kompetisi</h3>
          <p className="text-sm text-indigo-700 mb-4">
            Saat ini berada di tahap: <strong className="uppercase">{activeComp.phase}</strong>
          </p>
          <form action={async () => {
            'use server';
            await advancePhaseAction(activeComp.id);
          }}>
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm transition">
              Lanjut ke Tahap Berikutnya
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
