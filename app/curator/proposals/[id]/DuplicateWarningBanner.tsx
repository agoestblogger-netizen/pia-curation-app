'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface Warning {
  id: number;
  otherProposalId: number;
  otherProposalTitle: string;
  otherProposalNomor: number;
  markedByName: string;
  markedAt: Date;
  aiSimilarityLevel: string;
  status: string;
}

export default function DuplicateWarningBanner({ warnings }: { warnings: Warning[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (warnings.length === 0) return null;

  const handleOpenCompare = (otherId: number, otherTitle: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('compareId', otherId.toString());
    params.set('compareTitle', otherTitle);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });

    // Try to scroll to the comparison panel after a short delay to allow it to render
    setTimeout(() => {
      const panel = document.getElementById('compare-proposals-panel');
      if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg shadow-sm">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-amber-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="ml-3 w-full">
          <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider">Potensi Duplikat Terdeteksi</h3>
          <p className="text-sm text-amber-800 mt-1">
            Kurator tidak bisa membatalkan status ini sendiri. Kalau kedua pihak sepakat ini bukan duplikasi, silakan hubungi Koordinator untuk membatalkan status.
          </p>
          
          <div className="mt-3 space-y-3">
            {warnings.map(w => (
              <div key={w.id} className="bg-white/60 p-3 rounded border border-amber-200 text-sm text-amber-900">
                <p>
                  Proposal ini pernah ditandai berpotensi mirip dengan:
                  <br />
                  <strong className="block mt-1">No. {w.otherProposalNomor} — {w.otherProposalTitle}</strong>
                </p>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs opacity-90">
                  <div>Ditandai oleh: <span className="font-semibold">{w.markedByName}</span></div>
                  <div>Pada: <span className="font-semibold">{new Date(w.markedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                  <div>Kemiripan AI: <span className="font-semibold">{w.aiSimilarityLevel}</span></div>
                </div>
                <div className="mt-3">
                  <button
                    onClick={() => handleOpenCompare(w.otherProposalId, w.otherProposalTitle)}
                    className="text-amber-700 font-bold hover:text-amber-900 hover:underline flex items-center gap-1"
                  >
                    Lihat Detail Perbandingan
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
