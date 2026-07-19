import { requireRole } from '@/lib/auth/helpers';
import { getResetStatsAction } from '@/app/actions/reset-data';
import ResetDataClient from './ResetDataClient';

export const metadata = {
  title: 'Reset Data Testing - PIA Curation',
};

export default async function ResetDataPage() {
  await requireRole('admin');
  
  const stats = await getResetStatsAction();

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-red-700 mb-1">Reset Data Uji Coba</h1>
        <p className="text-gray-600 text-sm">
          Menu khusus Admin untuk membersihkan data hasil uji coba pada kompetisi aktif saat ini.
          Data proposal (yang di-import) dan data user <strong>TIDAK AKAN DIHAPUS</strong>, sehingga Anda tidak perlu meng-import ulang.
        </p>
      </div>

      {!stats ? (
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg">
          Tidak ada kompetisi aktif. Tidak bisa melakukan reset data.
        </div>
      ) : (
        <ResetDataClient stats={stats} />
      )}
    </div>
  );
}
