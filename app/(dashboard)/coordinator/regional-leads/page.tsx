import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import RegionalLeadClient from './RegionalLeadClient';
import { db } from '@/lib/db';
import { users, regionalLeads } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export default async function RegionalLeadsPage() {
  const session = await getSession();
  if (!session || !session.roles.includes('coordinator')) {
    redirect('/login');
  }

  // Get active curators
  const curators = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.isActive, true), sql`'curator' = ANY(${users.roles})`));

  // Get current leads
  const leads = await db
    .select({
      regionCenter: regionalLeads.regionCenter,
      curatorId: regionalLeads.curatorId,
      curatorName: users.name,
    })
    .from(regionalLeads)
    .leftJoin(users, eq(regionalLeads.curatorId, users.id));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Konfigurasi Regional Leads</h1>
        <p className="text-sm text-gray-500 mt-1">Kelola akses submission babak Regional per wilayah</p>
      </div>
      <RegionalLeadClient curators={curators} leads={leads} />
    </div>
  );
}
