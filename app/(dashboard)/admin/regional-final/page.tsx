import { getRegionalFinalSessions, getAvailableRegionalUsers } from '@/app/actions/regional-final-judging';
import { getActiveCompetition } from '@/app/actions/competitions';
import { requireRole } from '@/lib/auth/helpers';
import AdminRegionalFinalClient from './AdminRegionalFinalClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export const metadata = {
  title: 'Kelola Final Regional - PIA Curation',
};

export default async function AdminRegionalFinalPage() {
  await requireRole(['coordinator', 'admin']);

  const activeComp = await getActiveCompetition();
  if (!activeComp) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Kelola Final Regional</h1>
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg">
          Belum ada kompetisi aktif.
        </div>
      </div>
    );
  }

  const sessions = await getRegionalFinalSessions(activeComp.id);
  const availableUsers = await getAvailableRegionalUsers();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Kelola Final Regional</h1>
      <p className="text-gray-600 mb-6">Penugasan Juri Regional dan pantau status per grup (Kanwil/Pusat).</p>

      <AdminRegionalFinalClient sessions={sessions} availableUsers={availableUsers} />
    </div>
  );
}
