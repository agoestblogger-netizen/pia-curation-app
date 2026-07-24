'use client';

import { useState, useTransition } from 'react';
import { updateCompetitionSettingsAction } from '@/app/actions/settings';
import { useRouter } from 'next/navigation';

export default function SettingsClient({ 
  competitionId, 
  initialVisibility,
  initialRegionalCuratorMode = 'single',
  initialShowGugurProposals = false,
}: { 
  competitionId: number, 
  initialVisibility: 'open' | 'closed',
  initialRegionalCuratorMode?: 'single' | 'multiple',
  initialShowGugurProposals?: boolean,
}) {
  const [visibility, setVisibility] = useState<'open' | 'closed'>(initialVisibility);
  const [regionalCuratorMode, setRegionalCuratorMode] = useState<'single' | 'multiple'>(initialRegionalCuratorMode);
  const [showGugurProposals, setShowGugurProposals] = useState<boolean>(initialShowGugurProposals);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const router = useRouter();

  const isChanged = visibility !== initialVisibility || regionalCuratorMode !== initialRegionalCuratorMode || showGugurProposals !== initialShowGugurProposals;

  const handleSave = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('sponsorScoreVisibility', visibility);
      formData.append('regionalCuratorMode', regionalCuratorMode);
      formData.append('showGugurProposals', String(showGugurProposals));
      const res = await updateCompetitionSettingsAction(competitionId, formData);
      if (res.error) {
        setMessage('Gagal: ' + res.error);
      } else {
        setMessage('Pengaturan berhasil disimpan.');
        router.refresh();
      }
      setTimeout(() => setMessage(''), 3000);
    });
  };

  return (
    <div className="space-y-6">
      {/* Setting 1: Visibilitas Skor Sponsor */}
      <div className="pb-6 border-b border-gray-100">
        <label className="block text-sm font-semibold text-gray-900 mb-1">Visibilitas Skor Sponsor (Grand Final)</label>
        <p className="text-xs text-gray-500 mb-3">Pengaturan visibilitas skor antar Sponsor selama Sidang Penetapan berlangsung.</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <label className="flex items-center space-x-2 cursor-pointer bg-gray-50 p-3 rounded-lg border border-gray-200 hover:bg-gray-100 flex-1">
            <input 
              type="radio" 
              name="visibility" 
              value="open"
              checked={visibility === 'open'}
              onChange={() => setVisibility('open')}
              className="text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900 block">Terbuka</span>
              <span className="text-xs text-gray-500 block">Sponsor dapat melihat skor Sponsor lain</span>
            </div>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer bg-gray-50 p-3 rounded-lg border border-gray-200 hover:bg-gray-100 flex-1">
            <input 
              type="radio" 
              name="visibility" 
              value="closed"
              checked={visibility === 'closed'}
              onChange={() => setVisibility('closed')}
              className="text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900 block">Tertutup</span>
              <span className="text-xs text-gray-500 block">Sponsor hanya melihat skornya sendiri</span>
            </div>
          </label>
        </div>
      </div>

      {/* Setting 2: Mode Assignment Kurator Regional */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-1">Mode Assignment Kurator Regional</label>
        <p className="text-xs text-gray-500 mb-3">Menentukan apakah 1 grup regional (misal Kantor Pusat / Kanwil) hanya boleh di-assign ke 1 kurator atau bisa dibagi ke beberapa kurator.</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <label className="flex items-start space-x-2 cursor-pointer bg-gray-50 p-3 rounded-lg border border-gray-200 hover:bg-gray-100 flex-1">
            <input 
              type="radio" 
              name="regionalCuratorMode" 
              value="single"
              checked={regionalCuratorMode === 'single'}
              onChange={() => setRegionalCuratorMode('single')}
              className="text-indigo-600 focus:ring-indigo-500 mt-0.5"
            />
            <div>
              <span className="text-sm font-medium text-gray-900 block">1 Regional = 1 Kurator (Default)</span>
              <span className="text-xs text-gray-500 block">Setiap grup regional secara eksklusif dikelola oleh 1 kurator penuh.</span>
            </div>
          </label>
          <label className="flex items-start space-x-2 cursor-pointer bg-gray-50 p-3 rounded-lg border border-gray-200 hover:bg-gray-100 flex-1">
            <input 
              type="radio" 
              name="regionalCuratorMode" 
              value="multiple"
              checked={regionalCuratorMode === 'multiple'}
              onChange={() => setRegionalCuratorMode('multiple')}
              className="text-indigo-600 focus:ring-indigo-500 mt-0.5"
            />
            <div>
              <span className="text-sm font-medium text-gray-900 block">1 Regional = Bebas Jumlah Kurator</span>
              <span className="text-xs text-gray-500 block">Proposal dalam 1 grup regional boleh dibagi rentangnya ke beberapa kurator sekaligus.</span>
            </div>
          </label>
        </div>
      </div>

      {/* Setting 3: Tampilkan Proposal Gugur di Daftar */}
      <div className="pb-6 border-b border-gray-100">
        <label className="block text-sm font-semibold text-gray-900 mb-1">Tampilkan Proposal Gugur di Daftar</label>
        <p className="text-xs text-gray-500 mb-3">Menentukan apakah proposal yang berstatus gugur (tidak resubmission) secara global ditampilkan pada daftar Semua Proposal.</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <label className="flex items-start space-x-2 cursor-pointer bg-gray-50 p-3 rounded-lg border border-gray-200 hover:bg-gray-100 flex-1">
            <input 
              type="radio" 
              name="showGugurProposals" 
              value="false"
              checked={!showGugurProposals}
              onChange={() => setShowGugurProposals(false)}
              className="text-indigo-600 focus:ring-indigo-500 mt-0.5"
            />
            <div>
              <span className="text-sm font-medium text-gray-900 block">Sembunyikan (Default)</span>
              <span className="text-xs text-gray-500 block">Proposal gugur disembunyikan dari daftar utama untuk menjaga fokus kurasi.</span>
            </div>
          </label>
          <label className="flex items-start space-x-2 cursor-pointer bg-gray-50 p-3 rounded-lg border border-gray-200 hover:bg-gray-100 flex-1">
            <input 
              type="radio" 
              name="showGugurProposals" 
              value="true"
              checked={showGugurProposals}
              onChange={() => setShowGugurProposals(true)}
              className="text-indigo-600 focus:ring-indigo-500 mt-0.5"
            />
            <div>
              <span className="text-sm font-medium text-gray-900 block">Tampilkan Proposal Gugur</span>
              <span className="text-xs text-gray-500 block">Proposal gugur akan dimunculkan dengan penanda status khusus.</span>
            </div>
          </label>
        </div>
      </div>
      
      <div className="flex items-center space-x-4 pt-2">
        <button 
          onClick={handleSave}
          disabled={isPending || !isChanged}
          className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {isPending ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
        {message && (
          <span className={`text-sm font-medium ${message.includes('Gagal') ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
