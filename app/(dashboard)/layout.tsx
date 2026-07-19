import { getSession } from '@/lib/auth/session';
import { logoutAction } from '@/app/actions/auth';
import Link from 'next/link';

import ClientSidebar from './ClientSidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <ClientSidebar session={session} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex justify-end items-center shrink-0 z-10">
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
