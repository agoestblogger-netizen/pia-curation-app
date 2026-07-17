import { getBatchWithAssignments, lockBatchAction, runAutoAssignAction } from '@/app/actions/batches';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/session';

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !session.roles.includes('coordinator')) return <div>Unauthorized</div>;

  const { id } = await params;
  const batchId = parseInt(id, 10);
  if (isNaN(batchId)) notFound();

  const batch = await getBatchWithAssignments(batchId);
  if (!batch) notFound();

  const assignmentsByStatus = {
    assigned: batch.assignments.filter((a) => a.status === 'assigned').length,
    in_review: batch.assignments.filter((a) => a.status === 'in_review').length,
    completed: batch.assignments.filter((a) => a.status === 'completed').length,
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">{batch.name}</h1>
        <div className="flex gap-4 text-sm text-gray-500">
          <span>Mode: <strong>{batch.assignmentMode}</strong></span>
          <span>Status: <strong className={batch.status === 'locked' ? 'text-green-600' : 'text-yellow-600'}>{batch.status}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-100 text-center">
          <div className="text-2xl font-bold text-gray-900">{batch.assignments.length}</div>
          <div className="text-sm text-gray-500">Total Assignment</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-100 text-center">
          <div className="text-2xl font-bold text-green-600">{assignmentsByStatus.completed}</div>
          <div className="text-sm text-gray-500">Selesai</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-100 text-center">
          <div className="text-2xl font-bold text-orange-500">{assignmentsByStatus.assigned + assignmentsByStatus.in_review}</div>
          <div className="text-sm text-gray-500">Pending</div>
        </div>
      </div>

      {batch.assignments.length === 0 && batch.status !== 'locked' && (
        <form action={async () => {
          'use server';
          await runAutoAssignAction(batchId, [], undefined);
        }} className="mb-6">
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 text-sm font-medium">
            Jalankan Auto-Assignment
          </button>
        </form>
      )}

      {batch.assignments.length > 0 && batch.status !== 'locked' && (
        <form action={async () => {
          'use server';
          await lockBatchAction(batchId);
        }} className="mb-6">
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 text-sm font-medium">
            Kunci Batch (Mulai Kurasi)
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kurator</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proposal ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {batch.assignments.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{a.curatorName ?? `Kurator #${a.curatorId}`}</td>
                <td className="px-4 py-3 text-gray-500">PROP-{a.proposalId}</td>
                <td className="px-4 py-3 text-gray-500">{a.category}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    a.status === 'completed' ? 'bg-green-100 text-green-800' :
                    a.status === 'in_review' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {a.status}
                  </span>
                </td>
              </tr>
            ))}
            {batch.assignments.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  Belum ada assignment — jalankan auto-assignment terlebih dahulu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
