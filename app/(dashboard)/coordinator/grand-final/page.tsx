import { getSession } from '@/lib/auth/session';
import { getActiveCompetition } from '@/app/actions/competitions';
import { getNominatedProposals, getGrandFinalSelections } from '@/app/actions/grand-final';
import GrandFinalFilterClient from './GrandFinalFilterClient';

export default async function GrandFinalFilterPage() {
  const session = await getSession();
  
  if (!session || !session.roles.includes('coordinator')) {
    return <div>Unauthorized</div>;
  }

  const activeComp = await getActiveCompetition();

  if (!activeComp || activeComp.phase !== 'nomination_filter') {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Filter Grand Final</h1>
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md">
          {activeComp 
            ? `Tahap Filter Grand Final belum dibuka atau sudah ditutup (Saat ini: ${activeComp.phase}).`
            : 'Belum ada kompetisi aktif.'}
        </div>
      </div>
    );
  }

  const proposals = await getNominatedProposals(activeComp.id);
  const selections = await getGrandFinalSelections(activeComp.id);
  const selectedIds = selections.map(s => s.proposalId);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Filter Grand Final</h1>
        <p className="text-gray-600">
          Pilih maksimal 10 proposal nominasi untuk masuk ke tahap Grand Final.
          Proposal yang tidak terpilih akan otomatis di-takeout saat hasil dikunci.
        </p>
      </div>

      <GrandFinalFilterClient 
        competitionId={activeComp.id} 
        proposals={proposals} 
        initialSelectedIds={selectedIds} 
      />
    </div>
  );
}
