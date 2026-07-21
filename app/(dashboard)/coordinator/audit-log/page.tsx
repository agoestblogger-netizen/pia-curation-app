import { getSession } from '@/lib/auth/session';
import { getActiveCompetition } from '@/app/actions/competitions';
import { db } from '@/lib/db';
import { auditLogs, users } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export default async function AuditLogPage() {
  const session = await getSession();

  if (!session || !session.roles.includes('admin')) {
    return <div className="p-8 text-red-500">Unauthorized. Anda harus login sebagai Admin.</div>;
  }

  const logs = await db
    .select({
      id: auditLogs.id,
      actorName: auditLogs.actorName,
      action: auditLogs.action,
      entity: auditLogs.entity,
      entityId: auditLogs.entityId,
      reason: auditLogs.reason,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Audit Log</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Waktu</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aktor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Keterangan</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 text-xs">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-gray-500 font-mono">
                  {log.createdAt ? new Date(log.createdAt).toLocaleString('id-ID') : '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{log.actorName ?? 'System'}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-medium">
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-500">{log.entity}</td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-400">{log.entityId ?? '-'}</td>
                <td className="px-4 py-3 text-gray-500">{log.reason ?? '-'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Belum ada audit log
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
