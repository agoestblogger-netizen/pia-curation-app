import { getSession } from '@/lib/auth/session';
import { getActiveCompetition } from '@/app/actions/competitions';
import { getBatchesByCompetition } from '@/app/actions/batches';
import CreateBatchForm from './CreateBatchForm';
import Link from 'next/link';

export default async function BatchesPage() {
  const session = await getSession();
  if (!session || !session.roles.includes('coordinator')) {
    return <div className="p-8 text-red-500">Unauthorized</div>;
  }

  const activeComp = await getActiveCompetition();
  if (!activeComp) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Manajemen Batch Kurasi</h1>
        <p className="text-gray-500">Belum ada kompetisi aktif.</p>
      </div>
    );
  }

  const batches = await getBatchesByCompetition(activeComp.id);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Manajemen Batch Kurasi</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Create Batch Form */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-bold mb-4">Buat Batch Baru</h2>
          <CreateBatchForm competitionId={activeComp.id} />
        </div>

        {/* Existing Batches */}
        <div>
          <h2 className="text-lg font-bold mb-4">Batch yang Ada</h2>
          {batches.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500 text-sm">
              Belum ada batch
            </div>
          ) : (
            <div className="space-y-3">
              {batches.map((batch) => (
                <div key={batch.id} className="bg-white rounded-lg shadow border border-gray-200 p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">{batch.name}</h3>
                      <div className="text-xs text-gray-500 mt-1 space-x-3">
                        <span>Mode: <span className="font-medium">{batch.assignmentMode}</span></span>
                        <span>Status: <span className={`font-medium ${batch.status === 'locked' ? 'text-green-600' : 'text-yellow-600'}`}>{batch.status}</span></span>
                      </div>
                    </div>
                    <Link
                      href={`/coordinator/batches/${batch.id}`}
                      className="text-sm text-indigo-600 hover:text-indigo-900 font-medium"
                    >
                      Detail &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
