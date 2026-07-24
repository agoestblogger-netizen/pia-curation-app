import { cookies } from 'next/headers';
import { getActiveCompetition } from '@/app/actions/competitions';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { proposals, curatorAssignments, users } from '@/lib/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function OverviewDashboard() {
  const session = await getSession();

  const cookieStore = await cookies();
  const activeRoleCookie = session ? cookieStore.get(`pia_active_role_${session.userId}`)?.value : null;

  // Jika activeRoleCookie bernilai 'regional' ATAU user HANYA memiliki role regional,
  // arahkan ke /regional-dashboard.
  const isRegionalActive = activeRoleCookie ? activeRoleCookie === 'regional' : (
    session &&
    session.roles.includes('regional') &&
    !session.roles.includes('admin') &&
    !session.roles.includes('coordinator') &&
    !session.roles.includes('curator')
  );

  if (isRegionalActive) {
    redirect('/regional-dashboard');
  }

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

  // ─── Parallelize Queries ──────────────────────────────────────────────────
  const statsPromise = db.execute(sql`
    SELECT 
      p.category, 
      p.region_center,
      COUNT(DISTINCT p.id) as total,
      COUNT(DISTINCT CASE WHEN ca.status = 'completed' THEN p.id ELSE NULL END) as curated
    FROM proposals p
    LEFT JOIN curator_assignments ca ON p.id = ca.proposal_id
    WHERE p.competition_id = ${activeComp.id}
      AND (p.status IS NULL OR p.status != 'gugur')
    GROUP BY p.category, p.region_center
  `);

  let curatorsPromise: Promise<any[]> = Promise.resolve([]);
  let assignmentsPromise: Promise<any[]> = Promise.resolve([]);
  const gugurPromise = db.select({ count: sql<number>`count(*)` })
    .from(proposals)
    .where(and(
      eq(proposals.competitionId, activeComp.id),
      eq(proposals.status, 'gugur')
    ));

  if (session?.roles?.includes('coordinator')) {
    curatorsPromise = db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(
        sql`'curator' = ANY(${users.roles})`,
        eq(users.isActive, true)
      ));

    assignmentsPromise = db
      .select({
        curatorId: curatorAssignments.curatorId,
        status: curatorAssignments.status,
        category: proposals.category,
        regionCenter: proposals.regionCenter,
      })
      .from(curatorAssignments)
      .innerJoin(proposals, eq(curatorAssignments.proposalId, proposals.id))
      .where(and(
        eq(proposals.competitionId, activeComp.id),
        sql`(${proposals.status} IS NULL OR ${proposals.status} != 'gugur')`
      ));
  }

  const [statsQuery, curators, assignments, [gugurStat]] = await Promise.all([
    statsPromise,
    curatorsPromise,
    assignmentsPromise,
    gugurPromise
  ]);

  const totalGugur = Number(gugurStat?.count) || 0;

  const statsData = statsQuery as unknown as any[];

  // Calculate Stats
  let totalAktif = 0;
  let totalTerkurasi = 0;

  const catTotal: Record<string, number> = { WILAYAH: 0, PUSAT: 0, BI: 0, BC: 0 };
  const catCurated: Record<string, number> = { WILAYAH: 0, PUSAT: 0, BI: 0, BC: 0 };
  
  const wilTotal: Record<string, number> = {};
  const wilCurated: Record<string, number> = {};

  statsData.forEach(row => {
    const total = Number(row.total) || 0;
    const curated = Number(row.curated) || 0;
    const cat = row.category;
    const rc = row.region_center;

    totalAktif += total;
    totalTerkurasi += curated;

    // Kategori
    if (cat in catTotal) {
      catTotal[cat] += total;
      catCurated[cat] += curated;
    }

    // Wilayah & Pusat
    if (cat === 'WILAYAH' && rc) {
      const city = `Kanwil ${rc}`;
      wilTotal[city] = (wilTotal[city] || 0) + total;
      wilCurated[city] = (wilCurated[city] || 0) + curated;
    } else if (cat === 'PUSAT') {
      const label = 'Kantor Pusat';
      wilTotal[label] = (wilTotal[label] || 0) + total;
      wilCurated[label] = (wilCurated[label] || 0) + curated;
    }
  });

  const totalResubmit = totalAktif;
  const totalSbd = totalAktif + totalGugur;

  // Sort Kanwil/Pusat alphabetically, but put Kantor Pusat at the end
  const sortedWilayahKeys = Object.keys(wilTotal).sort((a, b) => {
    if (a === 'Kantor Pusat') return 1;
    if (b === 'Kantor Pusat') return -1;
    return a.localeCompare(b);
  });

  // Calculate Curator Assignment Stats (Only for Coordinator)
  let curatorStats: { name: string; categoriesAssigned: string; total: number; completed: number; sisa: number }[] = [];
  if (session?.roles?.includes('coordinator')) {

    curatorStats = curators.map((c) => {
      const myAss = assignments.filter((a) => a.curatorId === c.id);
      const total = myAss.length;
      const completed = myAss.filter((a) => a.status === 'completed').length;
      const sisa = total - completed;
      
      const categoryCounts: Record<string, number> = {};
      myAss.forEach(a => {
        let catLabel = a.category;
        if (a.category === 'WILAYAH' && a.regionCenter) {
          catLabel = `Kanwil ${a.regionCenter}`;
        } else if (a.category === 'PUSAT') {
          catLabel = 'Kantor Pusat';
        } else if (a.category === 'BI') {
          catLabel = 'Breakthrough Innovation';
        } else if (a.category === 'BC') {
          catLabel = 'Business Case';
        }
        categoryCounts[catLabel] = (categoryCounts[catLabel] || 0) + 1;
      });

      const categoriesStr = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1]) // highest first
        .map(([name, count]) => `${name} (${count})`)
        .join(', ');

      return {
        name: c.name,
        categoriesAssigned: categoriesStr || '-',
        total,
        completed,
        sisa,
      };
    });

    // Sort by Sisa (descending), then alphabetically by name
    curatorStats.sort((a, b) => b.sisa - a.sisa || a.name.localeCompare(b.name));
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{activeComp.name} &middot; Tahap: <span className="font-semibold capitalize">{activeComp.phase.replace(/_/g, ' ')}</span></p>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div>
            <div className="text-sm text-gray-500 font-medium mb-1">Total Proposal SBD</div>
            <div className="text-3xl font-bold text-gray-900">{totalSbd.toLocaleString('id-ID')}</div>
          </div>
          <div className="mt-3 text-xs font-semibold text-gray-500 pt-2 border-t border-gray-100 flex items-center justify-between">
            <span>Resubmission: <strong className="text-emerald-600">{totalResubmit}</strong></span>
            <span>Gugur: <strong className="text-rose-600">{totalGugur}</strong></span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div>
            <div className="text-sm text-gray-500 font-medium mb-1">Proposal Aktif (Resubmission)</div>
            <div className="text-3xl font-bold text-emerald-600">{totalResubmit.toLocaleString('id-ID')}</div>
          </div>
          <div className="mt-3 text-xs text-gray-500 pt-2 border-t border-gray-100">
            Diproses dalam kegiatan kurasi aktif
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div>
            <div className="text-sm text-gray-500 font-medium mb-1">Tidak Resubmission (Gugur)</div>
            <div className="text-3xl font-bold text-rose-600">{totalGugur.toLocaleString('id-ID')}</div>
          </div>
          <div className="mt-3 text-xs text-gray-500 pt-2 border-t border-gray-100">
            Dikeluarkan dari alur kegiatan
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Category Breakdown (Fixed) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Distribusi Kategori</h2>
          </div>
          <div className="overflow-x-auto w-full">
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
                  <td className="px-5 py-3 font-semibold text-sm text-gray-900">
                    {cat === 'BC' ? 'Business Case' : cat === 'BI' ? 'Breakthrough Innovation' : cat}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{catTotal[cat]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Category Breakdown (Progress) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 bg-indigo-50/30">
            <h2 className="font-bold text-indigo-900">Progress Terkurasi per Kategori</h2>
          </div>
          <div className="overflow-x-auto w-full">
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
                  <td className="px-5 py-3 font-semibold text-sm text-gray-900">
                    {cat === 'BC' ? 'Business Case' : cat === 'BI' ? 'Breakthrough Innovation' : cat}
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold text-indigo-700">
                    {catCurated[cat]} / <span className="text-gray-500 font-normal">{catTotal[cat]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Region Breakdown (Fixed) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Distribusi per Kanwil/Pusat</h2>
          </div>
          <div className="overflow-x-auto w-full">
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
        </div>

        {/* Region Breakdown (Progress) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 bg-indigo-50/30">
            <h2 className="font-bold text-indigo-900">Progress Terkurasi per Kanwil/Pusat</h2>
          </div>
          <div className="overflow-x-auto w-full">
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
      </div>

      {session?.roles?.includes('coordinator') && (
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-bold text-gray-900">Assignment per Kurator</h2>
            <p className="text-xs text-gray-500 mt-1">Data beban kerja dan progres seluruh kurator (diurutkan berdasarkan sisa terbanyak).</p>
          </div>
          <div className="overflow-x-auto w-full">
          <table className="min-w-full divide-y divide-gray-100 flex-1">
            <thead className="bg-white">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kurator</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kategori yang Di-assign</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total Assigned</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Sudah Discreening</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Sisa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {curatorStats.map((stat) => (
                <tr key={stat.name} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-semibold text-sm text-gray-900">{stat.name}</td>
                  <td className="px-5 py-3 text-xs text-gray-500 max-w-xs truncate" title={stat.categoriesAssigned}>{stat.categoriesAssigned}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{stat.total}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-emerald-600">{stat.completed}</td>
                  <td className="px-5 py-3 text-sm font-bold text-rose-600">{stat.sisa}</td>
                </tr>
              ))}
              {curatorStats.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-4 text-center text-sm text-gray-500">
                    Belum ada kurator yang terdaftar atau aktif.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}


    </div>
  );
}
