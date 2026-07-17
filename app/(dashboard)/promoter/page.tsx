import { getSession } from '@/lib/auth/session';
import { getActiveCompetition } from '@/app/actions/competitions';
import { getPassedProposals, getPromoterSelections } from '@/app/actions/promoter';
import PromoterSelectionClient from './PromoterSelectionClient';

export default async function PromoterDashboard() {
  const session = await getSession();
  
  if (!session || !session.roles.includes('promoter')) {
    return <div>Unauthorized</div>;
  }

  const activeComp = await getActiveCompetition();

  if (!activeComp || activeComp.phase !== 'promotor_selection') {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Pemilihan Promotor</h1>
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md">
          {activeComp 
            ? `Tahap pemilihan promotor belum dibuka (Saat ini: ${activeComp.phase}).`
            : 'Belum ada kompetisi aktif.'}
        </div>
      </div>
    );
  }

  const proposals = await getPassedProposals(activeComp.id);
  const selections = await getPromoterSelections(activeComp.id, session.userId);
  const selectedIds = selections.map(s => s.proposalId);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Pemilihan Proposal</h1>
        <p className="text-gray-600">
          Pilih proposal yang ingin Anda sponsori/dukung. Proposal yang Anda pilih akan masuk ke tahap Nominasi.
        </p>
      </div>

      <PromoterSelectionClient 
        competitionId={activeComp.id} 
        proposals={proposals} 
        initialSelectedIds={selectedIds} 
      />
    </div>
  );
}
