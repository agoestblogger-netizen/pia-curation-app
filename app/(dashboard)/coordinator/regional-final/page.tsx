import { requireRole } from '@/lib/auth/helpers';
import { getActiveCompetition } from '@/app/actions/competitions';
import { getRegionalGroups } from '@/app/actions/regional-final';
import RegionalFinalClient from './RegionalFinalClient';

export const metadata = {
  title: 'Kunci Finalis Regional - PIA Curation',
};

export default async function RegionalFinalPage() {
  const session = await requireRole(['coordinator', 'viewer']);
  const activeComp = await getActiveCompetition();

  if (!activeComp) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Kunci Finalis Regional</h1>
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg">
          Belum ada kompetisi aktif.
        </div>
      </div>
    );
  }

  const groups = await getRegionalGroups(activeComp.id);
  const totalFinalists = groups.reduce((acc, g) => acc + g.finalistCount, 0);
  const lockedGroups = groups.filter(g => g.isLocked).length;
  const readOnly = session.roles.includes('viewer') && !session.roles.includes('coordinator');

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Kunci Finalis Regional</h1>
        <p className="text-gray-500 text-sm">
          Pilih maksimal 10 finalis per grup (Kanwil 1–12 dan Kantor Pusat). 
          Setelah mengunci, proposal yang tidak terpilih akan otomatis di-takeout.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Total Grup</div>
          <div className="text-2xl font-bold text-gray-900">{groups.length}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Total Finalis Dipilih</div>
          <div className="text-2xl font-bold text-indigo-600">{totalFinalists}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Grup Terkunci</div>
          <div className="text-2xl font-bold text-green-600">{lockedGroups} / {groups.length}</div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-xl text-center">
          <p className="font-semibold mb-1">Belum ada proposal yang siap difinalisasi.</p>
          <p className="text-sm">Proposal WILAYAH dan PUSAT yang sudah lolos screening (status: curation_passed) akan tampil di sini.</p>
        </div>
      ) : (
        <RegionalFinalClient competitionId={activeComp.id} groups={groups} readOnly={readOnly} />
      )}
    </div>
  );
}
