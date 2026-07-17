import { getActiveCompetition, getProposalCountByCategory, advancePhaseAction } from '@/app/actions/competitions';
import { db } from '@/lib/db';
import { proposals } from '@/lib/db/schema';
import { eq, count, and } from 'drizzle-orm';
import Link from 'next/link';

export default async function CoordinatorDashboard() {
  const activeComp = await getActiveCompetition();

  if (!activeComp) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Dashboard Koordinator</h1>
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md">
          Belum ada kompetisi aktif. Silakan buat kompetisi baru (Fitur belum tersedia di UI).
        </div>
      </div>
    );
  }

  const categoryCounts = await getProposalCountByCategory(activeComp.id);
  const totalProposals = categoryCounts.reduce((acc, curr) => acc + curr.count, 0);

  const [nominationCountResult] = await db
    .select({ count: count() })
    .from(proposals)
    .where(eq(proposals.status, 'promotor_nominated'));

  const [regionalFinalistResult] = await db
    .select({ count: count() })
    .from(proposals)
    .where(eq(proposals.status, 'regional_finalist'));

  const [needsReviewResult] = await db
    .select({ count: count() })
    .from(proposals)
    .where(and(eq(proposals.competitionId, activeComp.id), eq(proposals.needsReview, true)));

  const nominationCount = nominationCountResult?.count || 0;
  const regionalFinalistCount = regionalFinalistResult?.count || 0;
  const needsReviewCount = needsReviewResult?.count || 0;

  // Status breakdown
  const statusBreakdown = await db
    .select({ status: proposals.status, count: count() })
    .from(proposals)
    .where(eq(proposals.competitionId, activeComp.id))
    .groupBy(proposals.status);

  const STATUS_LABELS: Record<string, string> = {
    imported: 'Diimport',
    under_curation: 'Sedang Dikurasi',
    curation_passed: 'Lolos Screening',
    curation_rejected: 'Tidak Lolos',
    regional_finalist: 'Finalis Regional',
    promotor_nominated: 'Nominasi Promotor',
    grand_final: 'Grand Final',
    winner: 'Pemenang',
    takeout: 'Takeout',
  };

  // Needs review proposals
  const needsReviewProposals = needsReviewCount > 0
    ? await db
        .select({ id: proposals.id, title: proposals.title, category: proposals.category, status: proposals.status, externalSubId: proposals.externalSubId })
        .from(proposals)
        .where(and(eq(proposals.competitionId, activeComp.id), eq(proposals.needsReview, true)))
        .limit(10)
    : [];

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Koordinator</h1>
          <p className="text-gray-500 text-sm mt-1">{activeComp.name} · Tahap: <span className="font-semibold capitalize">{activeComp.phase}</span></p>
        </div>
        <div className="flex space-x-3">
          <a
            href="/api/pdf/proposals"
            target="_blank"
            className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-xl hover:bg-indigo-50"
          >
            Export PDF
          </a>
          <Link href="/coordinator/proposals" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700">
            Semua Proposal →
          </Link>
        </div>
      </div>

      {/* Needs Review Alert */}
      {needsReviewCount > 0 && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-orange-800">{needsReviewCount} proposal perlu ditinjau</p>
              <p className="text-sm text-orange-600">Data CIDA berubah setelah proposal diproses.</p>
            </div>
          </div>
          <Link href="/coordinator/proposals?needsReview=1" className="px-4 py-2 text-sm font-semibold text-orange-700 border border-orange-300 rounded-lg hover:bg-orange-100">
            Lihat Semua
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="text-sm text-gray-500 font-medium mb-1">Total Proposal</div>
          <div className="text-3xl font-bold text-gray-900">{totalProposals.toLocaleString('id-ID')}</div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="text-sm text-gray-500 font-medium mb-1">Finalis Regional</div>
          <div className="text-3xl font-bold text-emerald-600">{regionalFinalistCount}</div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="text-sm text-gray-500 font-medium mb-1">Nominasi Promotor</div>
          <div className="text-3xl font-bold text-yellow-600">{nominationCount}</div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="text-sm text-gray-500 font-medium mb-1">Perlu Ditinjau</div>
          <div className={`text-3xl font-bold ${needsReviewCount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{needsReviewCount}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Category Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Distribusi Kategori</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kategori</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categoryCounts.map((c) => (
                <tr key={c.category}>
                  <td className="px-5 py-3 font-semibold text-sm text-gray-900">{c.category}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Status Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Status Proposal</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {statusBreakdown.map((s) => (
                <tr key={s.status}>
                  <td className="px-5 py-3 text-sm text-gray-700">{STATUS_LABELS[s.status] ?? s.status}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-gray-900">{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { href: '/coordinator/regional-final', label: '🏅 Final Regional', desc: 'Pilih finalis per grup' },
          { href: '/coordinator/batches', label: '📦 Batch Kurasi', desc: 'Kelola penugasan kurator' },
          { href: '/coordinator/grand-final', label: '🏆 Grand Final', desc: 'Filter nominasi BI/BC' },
          { href: '/coordinator/finalization', label: '🎖️ Finalisasi', desc: 'Ranking & pemenang' },
          { href: '/coordinator/users', label: '👥 User', desc: 'Tambah/kelola akun' },
          { href: '/coordinator/proposals', label: '📋 Semua Proposal', desc: 'Cari & filter' },
          { href: '/coordinator/audit-log', label: '📒 Audit Log', desc: 'Riwayat tindakan' },
        ].map(link => (
          <Link key={link.href} href={link.href} className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all group">
            <div className="font-semibold text-sm text-gray-900 group-hover:text-indigo-700">{link.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{link.desc}</div>
          </Link>
        ))}
      </div>

      {/* Needs Review Proposals */}
      {needsReviewProposals.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-orange-100 bg-orange-50">
            <h2 className="font-bold text-orange-900">⚠️ Proposal yang Perlu Ditinjau</h2>
            <p className="text-xs text-orange-600 mt-0.5">Data sumber dari CIDA berubah setelah proposal ini diproses.</p>
          </div>
          <table className="min-w-full divide-y divide-orange-100">
            <tbody className="divide-y divide-gray-100">
              {needsReviewProposals.map(p => (
                <tr key={p.id} className="hover:bg-orange-50">
                  <td className="px-5 py-3 text-xs font-mono text-gray-400">{p.externalSubId ?? '-'}</td>
                  <td className="px-5 py-3 font-medium text-sm text-gray-900 max-w-xs truncate">{p.title}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">{p.category}</td>
                  <td className="px-5 py-3">
                    <Link href={`/coordinator/proposals/${p.id}/history`} className="text-xs text-indigo-600 hover:underline">
                      Lihat Riwayat →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Advance Phase */}
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
    </div>
  );
}
