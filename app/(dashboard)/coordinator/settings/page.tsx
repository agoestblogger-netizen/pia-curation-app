import { requireRole } from '@/lib/auth/helpers';
import { getSession } from '@/lib/auth/session';
import { listUsersAction } from '@/app/actions/users';
import { db } from '@/lib/db';
import { competitions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import UserManagementClient from './UserManagementClient';
import SettingsClient from './SettingsClient';

export const metadata = {
  title: 'Pengaturan Sistem & User - PIA Curation',
};

export default async function SettingsPage() {
  const session = await requireRole(['coordinator', 'admin']);
  
  // Data for Users
  const users = await listUsersAction();
  const isViewerOnly = session.roles.includes('viewer') && !session.roles.includes('coordinator') && !session.roles.includes('admin');
  const isAdmin = session.roles.includes('admin');

  // Data for Settings
  const [activeComp] = await db.select().from(competitions).where(eq(competitions.isActive, true)).limit(1);

  return (
    <div className="p-8 max-w-5xl space-y-12">
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Pengaturan & Manajemen</h1>
          <p className="text-gray-500 text-sm">
            Kelola konfigurasi sistem dan manajemen user dalam satu tempat.
          </p>
        </div>

        {/* SECTION: Pengaturan Kompetisi */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            Pengaturan Kompetisi
          </h2>
          {!activeComp ? (
            <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl border border-yellow-200">
              Tidak ada kompetisi aktif.
            </div>
          ) : (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
              <SettingsClient 
                competitionId={activeComp.id} 
                initialVisibility={activeComp.sponsorScoreVisibility as 'open' | 'closed'} 
                initialRegionalCuratorMode={(activeComp.regionalCuratorMode ?? 'single') as 'single' | 'multiple'}
                initialShowGugurProposals={activeComp.showGugurProposals ?? false}
              />
            </div>
          )}
        </section>

        {/* SECTION: Manajemen User */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            Manajemen User
          </h2>
          <div className="mb-4">
            <p className="text-gray-500 text-sm">
              Tambah user baru atau nonaktifkan akun yang tidak lagi digunakan.
            </p>
          </div>
          <UserManagementClient
            users={users.map(u => ({ ...u, createdAt: u.createdAt ?? null }))}
            currentUserId={session.userId}
            currentUserRoles={session.roles}
            readOnly={isViewerOnly}
          />
        </section>
      </div>
    </div>
  );
}
