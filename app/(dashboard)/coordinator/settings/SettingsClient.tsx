'use client';

import { useState, useTransition } from 'react';
import { updateCompetitionSettingsAction } from '@/app/actions/settings';
import { useRouter } from 'next/navigation';

export default function SettingsClient({ 
  competitionId, 
  initialVisibility 
}: { 
  competitionId: number, 
  initialVisibility: 'open' | 'closed' 
}) {
  const [visibility, setVisibility] = useState<'open' | 'closed'>(initialVisibility);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleSave = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('sponsorScoreVisibility', visibility);
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
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Visibilitas Skor Sponsor</label>
        <div className="flex space-x-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input 
              type="radio" 
              name="visibility" 
              value="open"
              checked={visibility === 'open'}
              onChange={() => setVisibility('open')}
              className="text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-900">Terbuka (Sponsor dapat melihat skor Sponsor lain)</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input 
              type="radio" 
              name="visibility" 
              value="closed"
              checked={visibility === 'closed'}
              onChange={() => setVisibility('closed')}
              className="text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-900">Tertutup (Sponsor hanya melihat skornya sendiri)</span>
          </label>
        </div>
      </div>
      
      <div className="flex items-center space-x-4 pt-4">
        <button 
          onClick={handleSave}
          disabled={isPending || visibility === initialVisibility}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
        {message && (
          <span className={`text-sm ${message.includes('Gagal') ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
