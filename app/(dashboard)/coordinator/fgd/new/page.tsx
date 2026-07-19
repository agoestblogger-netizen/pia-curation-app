import { getSession } from '@/lib/auth/session';
import { getActiveCompetition } from '@/app/actions/competitions';
import { db } from '@/lib/db';
import { proposals } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import NewFgdClient from './NewFgdClient';

export default async function NewFgdPage() {
  const session = await getSession();
  if (!session || !session.roles.includes('coordinator')) {
    return <div>Unauthorized</div>;
  }

  const activeComp = await getActiveCompetition();
  if (!activeComp) {
    return <div className="p-8">Belum ada kompetisi aktif.</div>;
  }

  // Get available regions for the "Regional" dropdown
  const regionsRaw = await db
    .selectDistinct({ regionCenter: proposals.regionCenter })
    .from(proposals)
    .where(and(
      eq(proposals.competitionId, activeComp.id),
      eq(proposals.category, 'WILAYAH')
    ));
    
  const regions = regionsRaw
    .map(r => r.regionCenter)
    .filter((r): r is string => r !== null)
    .sort();
  // Also add 'PUSAT' as it's treated as a region in some contexts
  regions.push('Kantor Pusat');

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Buat Sesi FGD Baru</h1>
        <p className="text-gray-600">
          Setup ruang diskusi untuk Tim Kurator. Tentukan target jumlah proposal dan filter status yang ingin dibahas.
        </p>
      </div>

      <NewFgdClient competitionId={activeComp.id} regions={regions} />
    </div>
  );
}
