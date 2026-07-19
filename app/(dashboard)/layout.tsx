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
          {session && (
            <Link href="/overview" className="block px-4 py-2 rounded hover:bg-indigo-800">
              Dashboard
            </Link>
          )}

          {session?.roles?.includes('coordinator') && (
            <>
              <Link href="/coordinator/batches" className="block px-4 py-2 rounded hover:bg-indigo-800 text-sm">
                Assign Proposal
              </Link>
              <Link href="/coordinator/fgd" className="block px-4 py-2 rounded hover:bg-indigo-800 text-sm">
                FGD Tim Kurator
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

          {session?.roles?.includes('admin') && (
            <>
              <div className="border-t border-indigo-800 my-2" />
              <div className="px-4 py-1 text-xs font-bold text-red-400 uppercase tracking-wider">
                Admin Zone
              </div>
              <Link href="/admin/reset-data" className="block px-4 py-2 rounded hover:bg-red-900/50 text-red-300 text-sm font-medium transition-colors">
                Reset Data Testing
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
              <Link href="/coordinator/fgd" className="block px-4 py-2 rounded hover:bg-indigo-800 text-sm">
                FGD Tim Kurator
              </Link>
            </>
          )}

        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-end items-center shrink-0 z-10">
          <div className="flex items-center space-x-6">
            <Link href="/settings/password" className="text-sm font-semibold text-gray-600 hover:text-indigo-600 transition-colors">
              Ganti Password
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-sm font-bold text-red-600 hover:text-red-800 transition-colors"
              >
                Logout
              </button>
            </form>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
