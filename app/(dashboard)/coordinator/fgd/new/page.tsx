import { getSession } from '@/lib/auth/session';
import { getActiveCompetition } from '@/app/actions/competitions';
import { db } from '@/lib/db';
import { proposals, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import NewFgdClient from './NewFgdClient';
import { Suspense } from 'react';

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

  // Fetch all active users for Ketua and Sekretaris dropdowns
  const activeUsers = await db
    .select({ name: users.name, roles: users.roles })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(users.name);
    
  // Filter for those who can be curators/coordinators (optional, but good UX)
  const candidateUsers = activeUsers.filter(u => u.roles.includes('curator') || u.roles.includes('coordinator') || u.roles.includes('promoter')).map(u => u.name);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Buat Sesi FGD Baru</h1>
        <p className="text-gray-600">
          Setup ruang diskusi. Tentukan target jumlah proposal dan filter status yang ingin dibahas.
        </p>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <NewFgdClient competitionId={activeComp.id} regions={regions} users={candidateUsers} />
      </Suspense>
    </div>
  );
}
