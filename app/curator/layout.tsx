import { getSession } from '@/lib/auth/session';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function CuratorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col font-sans">
      {/* Header matching Screenshot 1 */}
      <header className="bg-[#0A4736] px-8 py-4 flex justify-between items-center text-white sticky top-0 z-50">
        <div>
          <div className="text-[#4ADE80] text-xs font-bold tracking-widest uppercase mb-1">
            PIA SEASON 12
          </div>
          <h1 className="text-xl font-bold tracking-tight">Curation Workspace</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <Link href="/overview" className="text-sm text-[#4ADE80] font-semibold hover:underline mr-4 flex items-center">
            <span>📊 Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
            {session.roles.map(r => (
              <div key={r} className="px-4 py-1 rounded-full text-xs font-semibold bg-[#073629] border border-[#135A47] text-gray-300 capitalize">
                {r}
              </div>
            ))}
          </div>
          <form action={async () => {
            'use server';
            const { cookies } = await import('next/headers');
            (await cookies()).delete('session');
            const { redirect } = await import('next/navigation');
            redirect('/login');
          }}>
            <button
              type="submit"
              className="text-sm text-red-400 hover:text-red-300 transition-colors font-semibold"
            >
              Logout
            </button>
          </form>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto p-8">
        {children}
      </main>
    </div>
  );
}
