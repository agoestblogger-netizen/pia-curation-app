import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { competitions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  await requireRole('admin');

  const [activeComp] = await db.select().from(competitions).where(eq(competitions.isActive, true)).limit(1);

  if (!activeComp) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Pengaturan Kompetisi</h1>
        <div className="bg-white p-6 rounded-xl border border-gray-200 text-gray-500">
          Tidak ada kompetisi aktif.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Pengaturan Kompetisi</h1>
      
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sidang Penetapan (Grand Final)</h2>
          <p className="text-sm text-gray-500 mt-1">
            Pengaturan visibilitas skor antar Sponsor selama Sidang Penetapan berlangsung.
          </p>
        </div>
        
        <SettingsClient 
          competitionId={activeComp.id} 
          initialVisibility={activeComp.sponsorScoreVisibility as 'open' | 'closed'} 
        />
      </div>
    </div>
  );
}
