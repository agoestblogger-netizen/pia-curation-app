'use client';

import { useState } from 'react';
import Link from 'next/link';
import { logoutAction } from '@/app/actions/auth';

type Session = {
  userId: number;
  name: string;
  roles: string[];
} | null;

export default function ClientSidebar({ session }: { session: Session }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden bg-indigo-900 text-white p-4 flex items-center justify-between sticky top-0 z-40">
        <div className="font-bold text-lg">PIA Curation App</div>
        <button 
          onClick={() => setIsOpen(!isOpen)} 
          className="p-2 bg-indigo-800 rounded focus:outline-none"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <div className={`fixed inset-y-0 left-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 z-50 w-64 bg-indigo-900 text-white flex flex-col transition-transform duration-200 ease-in-out`}>
        <div className="p-4 text-xl font-bold border-b border-indigo-800 hidden md:block">
          PIA Curation App
        </div>
        
        <div className="p-4 text-sm text-indigo-300 border-b border-indigo-800 flex flex-col gap-3">
          <div>
            <div className="font-semibold text-white">{session?.name}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {session?.roles?.map(r => (
                <span key={r} className="px-2 py-0.5 bg-indigo-800 text-indigo-100 rounded-full text-xs font-medium capitalize">
                  {r}
                </span>
              ))}
            </div>
          </div>
          
          {session && (
            <div className="flex items-center gap-3 text-xs font-medium mt-1">
              <Link href="/settings/password" onClick={() => setIsOpen(false)} className="hover:text-white transition-colors">
                Ganti Password
              </Link>
              <span className="text-indigo-700">|</span>
              <form action={logoutAction}>
                <button type="submit" className="text-red-400 hover:text-red-300 transition-colors font-bold">
                  Logout
                </button>
              </form>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {(() => {
            if (!session) return null;
            const userRoles = session.roles || [];
            const hasRole = (roles: string[]) => roles.some(r => userRoles.includes(r));

            const MENU_ITEMS = [
              { label: 'Dashboard', path: '/overview', roles: ['coordinator', 'curator', 'promoter', 'sponsor', 'admin'] },
              { label: 'Assign Proposal', path: '/coordinator/batches', roles: ['coordinator'] },
              { label: 'Daftar Proposal (Kurator)', path: '/curator', roles: ['curator'], iconRight: '→' },
              { label: 'Papan Penilaian (Promotor)', path: '/promoter', roles: ['promoter'], iconRight: '→' },
              { label: 'Ruang FGD', path: '/coordinator/fgd', roles: ['coordinator', 'curator', 'promoter'] },
              { isDivider: true, roles: ['coordinator'] },
              { label: 'Semua Proposal', path: '/coordinator/proposals', roles: ['coordinator'] },
              { label: 'Finalisasi & Ranking', path: '/coordinator/finalization', roles: ['coordinator'] },
              { label: 'Manajemen User', path: '/coordinator/users', roles: ['coordinator'] },
              { label: 'Audit Log', path: '/coordinator/audit-log', roles: ['coordinator'] },
              { isDivider: true, roles: ['admin'] },
              { isHeader: true, headerText: 'Admin Zone', roles: ['admin'] },
              { label: 'Reset Data Testing', path: '/admin/reset-data', roles: ['admin'], customClass: 'hover:bg-red-900/50 text-red-300' },
            ];

            return MENU_ITEMS.filter(item => hasRole(item.roles)).map((item, idx) => {
              if (item.isDivider) {
                return <div key={`divider-${idx}`} className="border-t border-indigo-800 my-2" />;
              }
              if (item.isHeader) {
                return (
                  <div key={`header-${idx}`} className="px-4 py-1 text-xs font-bold text-red-400 uppercase tracking-wider">
                    {item.headerText}
                  </div>
                );
              }
              return (
                <Link 
                  key={item.path}
                  href={item.path!} 
                  className={`block px-4 py-2 rounded text-sm transition-colors ${
                    item.customClass ? item.customClass : 'hover:bg-indigo-800'
                  } ${item.iconRight ? 'flex items-center justify-between' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  <span>{item.label}</span>
                  {item.iconRight && <span className="text-indigo-400">{item.iconRight}</span>}
                </Link>
              );
            });
          })()}
        </nav>
      </div>
    </>
  );
}
