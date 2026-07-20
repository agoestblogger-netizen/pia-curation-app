import { getSession } from '@/lib/auth/session';
import { getProposalById } from '@/app/actions/proposals';
import { getCriteria, getSponsorScores } from '@/app/actions/scoring';
import { notFound } from 'next/navigation';
import ScoringFormClient from './ScoringFormClient';
import { getActiveCompetition } from '@/app/actions/competitions';
import FormattedTextDisplay from '@/app/components/FormattedTextDisplay';

export default async function ScoringDetailPage({
  params,
}: {
  params: Promise<{ proposalId: string }>;
}) {
  const session = await getSession();
  
  if (!session || !session.roles.includes('sponsor')) {
    return <div>Unauthorized</div>;
  }

  const activeComp = await getActiveCompetition();
  if (!activeComp) notFound();

  const { proposalId } = await params;
  const id = parseInt(proposalId, 10);
  if (isNaN(id)) notFound();

  const proposal = await getProposalById(id);
  if (!proposal || proposal.status !== 'grand_final') notFound();

  const criteria = await getCriteria(activeComp.id);
  const existingScores = await getSponsorScores(id, session.userId);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Form Penilaian</h1>
        <p className="text-gray-600">Berikan penilaian untuk proposal Grand Final.</p>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 mb-8 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900">{proposal.title}</h2>
          <div className="text-sm text-gray-500 mt-1 flex space-x-4">
            <span>ID: {proposal.externalId}</span>
            <span>Kategori: {proposal.category}</span>
            <span>Pengusul: {proposal.proposerName}</span>
          </div>
        </div>
        <div className="p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Summary</h3>
          <FormattedTextDisplay 
            proposalId={proposal.id}
            fieldName="summary"
            originalText={proposal.summary}
            formattedText={(proposal.formattedTexts as any)?.summary}
            canFormat={session.roles.includes('coordinator')}
          />
        </div>
      </div>

      <ScoringFormClient 
        competitionId={activeComp.id}
        proposalId={id}
        criteria={criteria}
        existingScores={existingScores}
      />
    </div>
  );
}
