'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/actions/auth';

type Session = {
  userId: number;
  name: string;
  roles: string[];
} | null;

export default function ClientSidebar({ 
  session, 
  regionalAssignments = { isPic: false, isJudge: false } 
}: { 
  session: Session;
  regionalAssignments?: { isPic: boolean; isJudge: boolean };
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const userRoles = session?.roles || [];
  const isAdmin = userRoles.includes('admin');
  const allFunctionalRoles = ['coordinator', 'curator', 'promoter', 'sponsor', 'regional'];
  const functionalRoles = userRoles.filter(r => allFunctionalRoles.includes(r));
  const hasMultipleFunctional = functionalRoles.length > 1;
  const showToggle = !isAdmin && hasMultipleFunctional;

  const [activeRole, setActiveRole] = useState<string>(() => {
    if (functionalRoles.includes('coordinator')) return 'coordinator';
    if (functionalRoles.includes('curator')) return 'curator';
    if (functionalRoles.includes('promoter')) return 'promoter';
    if (functionalRoles.includes('sponsor')) return 'sponsor';
    if (functionalRoles.includes('regional')) return 'regional';
    return functionalRoles[0] || '';
  });

  useEffect(() => {
    if (showToggle && session?.userId) {
      const saved = localStorage.getItem(`pia_active_role_${session.userId}`);
      if (saved && functionalRoles.includes(saved) && saved !== activeRole) {
        setActiveRole(saved);
      }
    }
  }, [showToggle, functionalRoles, session?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const role = e.target.value;
    setActiveRole(role);
    if (session?.userId) {
      localStorage.setItem(`pia_active_role_${session.userId}`, role);
    }
    
    // Lakukan refresh ulang & default ke dashboard sesuai role
    const targetDashboard = role === 'regional' ? '/regional-dashboard' : '/overview';
    window.location.href = targetDashboard;
  };

  // Hide sidebar on specific full-width pages
  if (pathname.includes('/sponsor/assess/') || pathname.includes('/regional-judge/assess/')) {
    return null;
  }

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
            
            {showToggle && (
              <div className="mt-4 p-2 bg-indigo-800/40 rounded-lg border border-indigo-700/50">
                <label className="text-[10px] uppercase text-indigo-300 font-bold mb-1 block tracking-wider">Tampil sebagai:</label>
                <select 
                  value={activeRole} 
                  onChange={handleRoleChange}
                  className="w-full bg-indigo-900 text-sm font-semibold text-white rounded border border-indigo-600 p-1.5 focus:outline-none focus:border-indigo-400 capitalize cursor-pointer"
                >
                  {functionalRoles.map(r => (
                    <option key={r} value={r} className="capitalize">{r}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          {session && (
            <div className="flex items-center gap-3 text-xs font-medium mt-1">
              <Link href="/settings/password" onClick={() => setIsOpen(false)} className="hover:text-white transition-colors">
                Ganti Password
              </Link>
              <span className="text-indigo-700">|</span>
              <form 
                action={logoutAction} 
                onSubmit={() => {
                  if (session?.userId) {
                    localStorage.removeItem(`pia_active_role_${session.userId}`);
                  }
                }}
              >
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
            
            const checkRoles = showToggle 
              ? (userRoles.includes('viewer') ? [activeRole, 'viewer'] : [activeRole]) 
              : userRoles;

            const hasRole = (roles: string[]) => roles.some(r => checkRoles.includes(r));

            const MENU_ITEMS = [
              { 
                label: 'Dashboard', 
                path: (checkRoles.includes('coordinator') || checkRoles.includes('admin') || checkRoles.includes('curator') || checkRoles.includes('promoter') || checkRoles.includes('sponsor') || checkRoles.includes('viewer')) 
                        ? '/overview' 
                        : '/regional-dashboard', 
                roles: ['coordinator', 'curator', 'promoter', 'sponsor', 'admin', 'regional', 'viewer'] 
              },
              
              { isDivider: true, roles: ['coordinator', 'curator', 'promoter', 'viewer'] },
              { isHeader: true, headerText: 'Kurasi Proposal', roles: ['coordinator', 'curator', 'promoter', 'viewer'] },
              { label: 'Assign Proposal', path: '/coordinator/batches', roles: ['coordinator'] },
              { label: 'Daftar Proposal (Kurator)', path: '/curator', roles: ['curator'], iconRight: '→' },
              { label: 'Semua Proposal', path: '/coordinator/proposals', roles: ['coordinator', 'viewer'] },
              
              { isDivider: true, roles: ['coordinator', 'curator', 'promoter'] },
              { isHeader: true, headerText: 'Finalisasi Proposal', roles: ['coordinator', 'curator', 'promoter'] },
              { label: 'Papan Penilaian (Promotor)', path: '/promoter', roles: ['promoter'], iconRight: '→' },
              { label: 'Ruang FGD', path: '/coordinator/fgd', roles: ['coordinator', 'curator', 'promoter'] },
              
              { isDivider: true, roles: ['coordinator', 'regional', 'admin'] },
              { isHeader: true, headerText: 'Penetapan Finalis', roles: ['coordinator', 'regional', 'admin'] },
              { isSubHeader: true, headerText: 'Regional', roles: ['coordinator', 'regional', 'admin'] },
              { label: 'Kunci Finalis Regional', path: '/coordinator/regional-final', roles: ['coordinator'], indent: true },
              { label: 'Kelola Final Regional', path: '/admin/regional-final', roles: ['coordinator', 'admin'], indent: true },
              { label: 'Hasil Final Regional', path: '/coordinator/hasil-regional', roles: ['coordinator'], indent: true },
              ...(regionalAssignments.isPic ? [{ label: 'Setup Final Regional', path: '/curator/regional-final', roles: ['regional'], indent: true }] : []),
              ...(regionalAssignments.isJudge ? [{ label: 'Penilaian Final Regional', path: '/regional-judge', roles: ['regional'], iconRight: '→', indent: true }] : []),
              
              { isSubHeader: true, headerText: 'Grand Final', roles: ['coordinator'] },
              { label: 'Kelola Grand Final', path: '/coordinator/grand-final/kelola', roles: ['coordinator'], indent: true },
              { label: 'Sidang Penetapan', path: '/coordinator/grand-final/sidang', roles: ['coordinator'], indent: true },
              { label: 'Hasil Grand Final', path: '/coordinator/grand-final/hasil', roles: ['coordinator'], indent: true },
              
              { isDivider: true, roles: ['coordinator'] },
              { isHeader: true, headerText: 'Setting', roles: ['coordinator'] },
              { label: 'Manajemen User', path: '/coordinator/settings', roles: ['coordinator'] },
              
              { isDivider: true, roles: ['admin'] },
              { isHeader: true, headerText: 'Admin Zone', roles: ['admin'] },
              { label: 'Audit Log', path: '/coordinator/audit-log', roles: ['admin'], customClass: 'hover:bg-red-900/50 text-red-300' },
              { label: 'Reset Data Testing', path: '/admin/reset-data', roles: ['admin'], customClass: 'hover:bg-red-900/50 text-red-300' },
            ];

            return MENU_ITEMS.filter(item => hasRole(item.roles)).map((item, idx) => {
              if (item.isDivider) {
                return <div key={`divider-${idx}`} className="border-t-2 border-indigo-700/60 my-4" />;
              }
              if (item.isHeader) {
                return (
                  <div key={`header-${idx}`} className="px-4 py-1 mt-2 mb-1 text-[11px] font-bold text-orange-400 uppercase tracking-wider bg-indigo-900/50">
                    {item.headerText}
                  </div>
                );
              }
              if (item.isSubHeader) {
                return (
                  <div key={`subheader-${idx}`} className="px-4 py-1.5 mt-1 text-xs font-bold text-indigo-300">
                    {item.headerText}
                  </div>
                );
              }
              return (
                <Link 
                  key={item.path}
                  href={item.path!} 
                  className={`block py-2 rounded text-sm transition-colors ${item.indent ? 'pl-8 pr-4' : 'px-4'} ${
                    item.customClass ? item.customClass : 'hover:bg-indigo-800 hover:text-white text-indigo-100'
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
