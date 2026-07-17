import { getSession } from '@/lib/auth/session';
import { logoutAction } from '@/app/actions/auth';
import Link from 'next/link';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-indigo-900 text-white flex flex-col">
        <div className="p-4 text-xl font-bold border-b border-indigo-800">
          PIA Curation App
        </div>
        
        <div className="p-4 text-sm text-indigo-300 border-b border-indigo-800">
          <div className="font-semibold text-white">{session?.name}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {session?.roles?.map(r => (
              <span key={r} className="px-2 py-0.5 bg-indigo-800 text-indigo-100 rounded-full text-xs font-medium capitalize">
                {r}
              </span>
            ))}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {session?.roles?.includes('coordinator') && (
            <Link href="/coordinator" className="block px-4 py-2 rounded hover:bg-indigo-800">
              Dashboard Koordinator
            </Link>
          )}

          {session?.roles?.includes('coordinator') && (
            <>
              <Link href="/coordinator/batches" className="block px-4 py-2 rounded hover:bg-indigo-800 text-sm">
                Batch Kurasi
              </Link>
              <Link href="/coordinator/regional-final" className="block px-4 py-2 rounded hover:bg-indigo-800 text-sm">
                Final Regional
              </Link>
              <Link href="/coordinator/promoter-selection" className="block px-4 py-2 rounded hover:bg-indigo-800 text-sm">
                Pemilihan Promotor
              </Link>
              <Link href="/coordinator/grand-final" className="block px-4 py-2 rounded hover:bg-indigo-800 text-sm">
                Filter Grand Final
              </Link>
              <Link href="/coordinator/finalization" className="block px-4 py-2 rounded hover:bg-indigo-800 text-sm">
                Finalisasi & Ranking
              </Link>
              <div className="border-t border-indigo-800 my-2" />
              <Link href="/coordinator/proposals" className="block px-4 py-2 rounded hover:bg-indigo-800 text-sm">
                Semua Proposal
              </Link>
              <Link href="/coordinator/users" className="block px-4 py-2 rounded hover:bg-indigo-800 text-sm">
                Manajemen User
              </Link>
              <Link href="/coordinator/audit-log" className="block px-4 py-2 rounded hover:bg-indigo-800 text-sm">
                Audit Log
              </Link>
            </>
          )}

          {session?.roles?.includes('curator') && (
            <>
              <div className="border-t border-indigo-800 my-2" />
              <Link href="/curator" className="block px-4 py-2 rounded hover:bg-indigo-800 text-sm flex items-center justify-between">
                <span>Papan Lelang (Kurator)</span>
                <span className="text-indigo-400">→</span>
              </Link>
            </>
          )}

        </nav>

        <div className="p-4 border-t border-indigo-800 space-y-2">
          <Link href="/settings/password" className="block w-full text-left px-4 py-2 text-indigo-300 hover:text-white hover:bg-indigo-800 rounded transition-colors">
            Ganti Password
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full text-left px-4 py-2 text-red-300 hover:text-white hover:bg-red-900/50 rounded transition-colors"
            >
              Logout
            </button>
          </form>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
