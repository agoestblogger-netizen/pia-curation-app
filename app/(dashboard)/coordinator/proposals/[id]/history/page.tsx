import { requireRole } from '@/lib/auth/helpers';
import { getProposalHistory } from '@/app/actions/history';
import { clearNeedsReviewAction } from '@/app/actions/import';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const EVENT_ICONS: Record<string, string> = {
  import: '📥',
  sync_update: '🔄',
  claim: '🙋',
  screening: '🔍',
  regional_finalist: '🏅',
  promoter_selection: '⭐',
  grand_final: '🏆',
  scoring: '📊',
  final_result: '🎖️',
  audit: '📋',
  status_change: '🔄',
};

const EVENT_COLORS: Record<string, string> = {
  import: 'bg-blue-100 border-blue-300 text-blue-800',
  sync_update: 'bg-orange-100 border-orange-300 text-orange-800',
  claim: 'bg-purple-100 border-purple-300 text-purple-800',
  screening: 'bg-indigo-100 border-indigo-300 text-indigo-800',
  regional_finalist: 'bg-green-100 border-green-300 text-green-800',
  promoter_selection: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  grand_final: 'bg-red-100 border-red-300 text-red-800',
  scoring: 'bg-cyan-100 border-cyan-300 text-cyan-800',
  final_result: 'bg-emerald-100 border-emerald-300 text-emerald-800',
  audit: 'bg-gray-100 border-gray-300 text-gray-800',
  status_change: 'bg-gray-100 border-gray-300 text-gray-800',
};

export default async function ProposalHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('coordinator');
  const { id } = await params;
  const proposalId = parseInt(id);

  if (isNaN(proposalId)) notFound();

  const history = await getProposalHistory(proposalId);
  if (!history) notFound();

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/overview" className="text-sm text-indigo-600 hover:underline">
          ← Dashboard
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{history.proposalTitle}</h1>
            <div className="flex items-center space-x-3 text-sm text-gray-500">
              <span className="px-2 py-0.5 rounded bg-gray-100 font-semibold">{history.category}</span>
              <span>Status: <strong>{history.status}</strong></span>
            </div>
          </div>
          {/* JSON Export */}
          <a
            href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(history.exportJson, null, 2))}`}
            download={`proposal-${proposalId}-history.json`}
            className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50"
          >
            ⬇ Export JSON
          </a>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

        <div className="space-y-6">
          {history.timeline.map((event) => (
            <div key={event.id} className="relative flex items-start pl-16">
              {/* Dot */}
              <div className="absolute left-4 w-4 h-4 rounded-full bg-white border-2 border-gray-400 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-gray-400" />
              </div>

              {/* Card */}
              <div className={`flex-1 p-4 rounded-xl border shadow-sm ${EVENT_COLORS[event.eventType] ?? 'bg-white border-gray-200'}`}>
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{EVENT_ICONS[event.eventType] ?? '•'}</span>
                    <span className="font-bold text-sm">{event.title}</span>
                  </div>
                  {event.timestamp && (
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                      {new Date(event.timestamp).toLocaleString('id-ID')}
                    </span>
                  )}
                </div>
                <p className="text-sm opacity-80 ml-7">{event.description}</p>
                {event.actor && (
                  <p className="text-xs text-gray-500 ml-7 mt-1">👤 {event.actor}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Clear NeedsReview if flagged */}
      {history.timeline.some(e => e.eventType === 'sync_update') && (
        <div className="mt-8 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between">
          <div>
            <p className="font-semibold text-orange-800">⚠️ Data sumber berubah — perlu ditinjau</p>
            <p className="text-sm text-orange-600">Ada perubahan data dari CIDA setelah proposal ini diproses.</p>
          </div>
          <form action={async () => {
            'use server';
            await clearNeedsReviewAction(proposalId);
          }}>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700">
              Tandai Sudah Ditinjau
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
