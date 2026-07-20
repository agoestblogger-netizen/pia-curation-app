'use client';

import { useState, useTransition } from 'react';
import { resetDataAction, ResetOptions } from '@/app/actions/reset-data';
import { useRouter } from 'next/navigation';

export default function ResetDataClient({ stats }: { stats: any }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [options, setOptions] = useState<ResetOptions>({
    resetScreening: false,
    resetAssignments: false,
    resetFgd: false,
    resetPromotor: false,
    resetRegionalFinal: false,
    resetSponsor: false,
    resetAuditLog: false,
  });

  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const hasSelectedAny = Object.values(options).some(Boolean);

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== 'RESET DATA') {
      setError('Ketik "RESET DATA" dengan benar untuk mengkonfirmasi.');
      return;
    }

    startTransition(async () => {
      setError(null);
      const res = await resetDataAction(options);
      if (res?.error) {
        setError(res.error);
        setShowConfirm(false);
      } else {
        setSuccess('Data berhasil di-reset: ' + res?.executedActions?.join(', '));
        setShowConfirm(false);
        setOptions({
          resetScreening: false,
          resetAssignments: false,
          resetFgd: false,
          resetPromotor: false,
          resetRegionalFinal: false,
          resetSponsor: false,
          resetAuditLog: false,
        });
        setConfirmText('');
        router.refresh();
      }
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
      <div className="p-6 bg-red-50 border-b border-red-100">
        <h2 className="font-bold text-red-800 text-lg">Peringatan: Zona Berbahaya</h2>
        <p className="text-sm text-red-600 mt-1">
          Aksi ini bersifat permanen dan tidak dapat dibatalkan. Pastikan Anda telah melakukan backup database (pg_dump) sebelum melakukan reset besar.
        </p>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            ✅ {success}
          </div>
        )}

        <div className="space-y-4">
          <label className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
            <input 
              type="checkbox" 
              className="mt-1 w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
              checked={options.resetScreening}
              onChange={(e) => setOptions(prev => ({ ...prev, resetScreening: e.target.checked }))}
            />
            <div>
              <div className="font-semibold text-gray-900">Hasil Screening</div>
              <div className="text-sm text-gray-500">Hapus {stats.screening} hasil screening. Proposal akan kembali ke status 'belum discreening' (assigned/imported).</div>
            </div>
          </label>

          <label className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
            <input 
              type="checkbox" 
              className="mt-1 w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
              checked={options.resetAssignments}
              onChange={(e) => setOptions(prev => ({ ...prev, resetAssignments: e.target.checked }))}
            />
            <div>
              <div className="font-semibold text-gray-900">Assignment Kurator</div>
              <div className="text-sm text-gray-500">Hapus {stats.assignment} assignment kurator dan batch. Daftar proposal kurator akan kosong.</div>
            </div>
          </label>

          <label className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
            <input 
              type="checkbox" 
              className="mt-1 w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
              checked={options.resetFgd}
              onChange={(e) => setOptions(prev => ({ ...prev, resetFgd: e.target.checked }))}
            />
            <div>
              <div className="font-semibold text-gray-900">Sesi FGD</div>
              <div className="text-sm text-gray-500">Hapus {stats.fgdSession} sesi FGD beserta seluruh vote dan komentar di dalamnya.</div>
            </div>
          </label>

          <label className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
            <input 
              type="checkbox" 
              className="mt-1 w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
              checked={options.resetPromotor}
              onChange={(e) => setOptions(prev => ({ ...prev, resetPromotor: e.target.checked }))}
            />
            <div>
              <div className="font-semibold text-gray-900">Pemilihan Promotor</div>
              <div className="text-sm text-gray-500">Hapus {stats.promotor} proposal terpilih oleh promotor dan set status proposal kembali ke Regional Finalist.</div>
            </div>
          </label>

          <label className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
            <input 
              type="checkbox" 
              className="mt-1 w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
              checked={options.resetRegionalFinal}
              onChange={(e) => setOptions(prev => ({ ...prev, resetRegionalFinal: e.target.checked }))}
            />
            <div>
              <div className="font-semibold text-gray-900">Finalisasi Regional & Grand Final</div>
              <div className="text-sm text-gray-500">Mereset {stats.regionalFinal} status proposal dari Finalis Regional ke atas, menjadi curation_passed. Hapus data ranking.</div>
            </div>
          </label>

          <label className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
            <input 
              type="checkbox" 
              className="mt-1 w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
              checked={options.resetSponsor}
              onChange={(e) => setOptions(prev => ({ ...prev, resetSponsor: e.target.checked }))}
            />
            <div>
              <div className="font-semibold text-gray-900">Penilaian Sponsor & Final Result</div>
              <div className="text-sm text-gray-500">Hapus {stats.sponsor} skor sponsor, snapshots, dan final results. Proposal akan kembali ke status grand_finalist.</div>
            </div>
          </label>

          <label className="flex items-start space-x-3 p-4 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer bg-gray-50/50">
            <input 
              type="checkbox" 
              className="mt-1 w-5 h-5 text-gray-600 rounded border-gray-300 focus:ring-gray-500"
              checked={options.resetAuditLog}
              onChange={(e) => setOptions(prev => ({ ...prev, resetAuditLog: e.target.checked }))}
            />
            <div>
              <div className="font-semibold text-gray-700">Audit Log (Opsional)</div>
              <div className="text-sm text-gray-500">Hapus seluruh {stats.auditLog} entri audit log untuk menghilangkan jejak aktivitas testing. Entri untuk reset ini akan tetap dicatat setelah pembersihan.</div>
            </div>
          </label>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100">
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={!hasSelectedAny}
              className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Lanjutkan Reset Data
            </button>
          ) : (
            <form onSubmit={handleReset} className="bg-red-50 p-6 rounded-xl border border-red-200">
              <h3 className="font-bold text-red-900 mb-2">Konfirmasi Tindakan</h3>
              <p className="text-sm text-red-700 mb-4">
                Ketik <strong className="font-mono bg-white px-1">RESET DATA</strong> di bawah ini untuk mengkonfirmasi penghapusan data.
              </p>
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Ketik RESET DATA"
                  className="flex-1 px-4 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
                  disabled={isPending}
                />
                <button
                  type="button"
                  onClick={() => { setShowConfirm(false); setConfirmText(''); }}
                  disabled={isPending}
                  className="px-4 py-2 bg-white text-gray-700 border border-gray-300 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={confirmText !== 'RESET DATA' || isPending}
                  className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isPending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <span>Ya, Reset Data!</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
