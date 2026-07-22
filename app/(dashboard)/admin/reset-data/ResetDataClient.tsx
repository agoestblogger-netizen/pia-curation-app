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
    resetKurasiNasional: false,
    resetRegionalLock: false,
    resetFinalRegional: false,
    resetGrandFinal: false,
    resetAuditLog: false,
    resetAiCache: false,
    resetPdfs: false,
    resetDuplicates: false,
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

    setError(null);
    setSuccess('Sedang melakukan reset data...');
    
    resetDataAction(options).then((res) => {
      if (res?.error) {
        setError(res.error);
        setSuccess(null);
        setShowConfirm(false);
      } else {
        window.location.reload();
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

        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 border-b pb-2">Kelompok Utama (Jalur Penilaian)</h3>
            
            <label className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input 
                type="checkbox" 
                className="mt-1 w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
                checked={options.resetKurasiNasional}
                onChange={(e) => setOptions(prev => ({ ...prev, resetKurasiNasional: e.target.checked }))}
              />
              <div>
                <div className="font-semibold text-gray-900">1. Reset Kurasi Nasional</div>
                <div className="text-sm text-gray-500">
                  Hapus data screening, assignment kurator, FGD Nasional, dan pemilihan Promotor. 
                  Proposal Pusat (Nasional) akan kembali ke status 'imported'. 
                  <span className="block mt-1 font-medium text-indigo-600">Terdeteksi: {stats.kurasiNasional} entri data terpengaruh.</span>
                </div>
              </div>
            </label>

            <label className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input 
                type="checkbox" 
                className="mt-1 w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
                checked={options.resetRegionalLock}
                onChange={(e) => setOptions(prev => ({ ...prev, resetRegionalLock: e.target.checked }))}
              />
              <div>
                <div className="font-semibold text-gray-900">2. Reset Regional (Kunci Finalis)</div>
                <div className="text-sm text-gray-500">
                  Kembalikan proposal yang berstatus 'regional_finalist' (10 besar Kanwil) ke 'imported'. 
                  TIDAK menghapus tabel sesi/PIC/skor di Final Regional.
                  <span className="block mt-1 font-medium text-indigo-600">Terdeteksi: {stats.regionalLock} proposal terkunci.</span>
                </div>
              </div>
            </label>

            <label className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input 
                type="checkbox" 
                className="mt-1 w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
                checked={options.resetFinalRegional}
                onChange={(e) => setOptions(prev => ({ ...prev, resetFinalRegional: e.target.checked }))}
              />
              <div>
                <div className="font-semibold text-gray-900">3. Reset Final Regional</div>
                <div className="text-sm text-gray-500">
                  Hapus SEMUA data PIC, Juri, Skor, dan Hasil Ranking di Final Regional. 
                  Status sesi kembali kosong. Proposal yang lolos ke Nasional akan diturunkan kembali ke 'regional_finalist'.
                  <span className="block mt-1 font-medium text-indigo-600">Terdeteksi: {stats.finalRegional} entri (sesi + proposal lolos).</span>
                </div>
              </div>
            </label>

            <label className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input 
                type="checkbox" 
                className="mt-1 w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
                checked={options.resetGrandFinal}
                onChange={(e) => setOptions(prev => ({ ...prev, resetGrandFinal: e.target.checked }))}
              />
              <div>
                <div className="font-semibold text-gray-900">4. Reset Grand Final (Sponsor/Nasional)</div>
                <div className="text-sm text-gray-500">
                  Hapus penilaian Grand Final, skor Sponsor, dan penetapan Pemenang Akhir. 
                  Proposal pemenang kembali menjadi 'grand_finalist'.
                  <span className="block mt-1 font-medium text-indigo-600">Terdeteksi: {stats.grandFinal} skor/penilaian.</span>
                </div>
              </div>
            </label>
          </div>

          <div className="space-y-4 pt-4">
            <h3 className="font-bold text-gray-900 border-b pb-2">Utilitas & Sistem (Opsional)</h3>

            <label className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input 
                type="checkbox" 
                className="mt-1 w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
                checked={options.resetAiCache}
                onChange={(e) => setOptions(prev => ({ ...prev, resetAiCache: e.target.checked }))}
              />
              <div>
                <div className="font-semibold text-gray-900">Cache Analisis AI</div>
                <div className="text-sm text-gray-500">Hapus {stats.aiCache} data Rangkuman AI, Klaim & Angka Kunci. Proposal kembali ke kondisi belum dianalisis.</div>
              </div>
            </label>

            <label className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input 
                type="checkbox" 
                className="mt-1 w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
                checked={options.resetPdfs}
                onChange={(e) => setOptions(prev => ({ ...prev, resetPdfs: e.target.checked }))}
              />
              <div>
                <div className="font-semibold text-gray-900">Dokumen Tambahan PDF</div>
                <div className="text-sm text-gray-500">Hapus {stats.pdfs} dokumen tambahan FGD (database & cloud storage).</div>
              </div>
            </label>

            <label className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input 
                type="checkbox" 
                className="mt-1 w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
                checked={options.resetDuplicates}
                onChange={(e) => setOptions(prev => ({ ...prev, resetDuplicates: e.target.checked }))}
              />
              <div>
                <div className="font-semibold text-gray-900">Potensi Duplikat</div>
                <div className="text-sm text-gray-500">Hapus {stats.duplicates} entri pendeteksian duplikat proposal.</div>
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
                <div className="font-semibold text-gray-700">Audit Log</div>
                <div className="text-sm text-gray-500">Hapus seluruh {stats.auditLog} entri audit log untuk menghilangkan jejak aktivitas testing.</div>
              </div>
            </label>
          </div>
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
