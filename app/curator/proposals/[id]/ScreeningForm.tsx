'use client';

import { useState } from 'react';
import { submitScreeningAction } from '@/app/actions/screening';
import { SCREENING_VERDICTS } from '@/lib/constants/screening';

export default function ScreeningForm({ assignmentId, isCompleted }: { assignmentId: number, isCompleted: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isCompleted) {
    return (
      <div className="bg-green-50 text-green-800 p-4 rounded-xl border border-green-200">
        ✅ Screening untuk proposal ini sudah selesai Anda lakukan.
      </div>
    );
  }

  return (
    <form 
      action={async (formData) => {
        setLoading(true);
        setError(null);
        try {
          const res = await submitScreeningAction({}, formData);
          if (res.error) setError(res.error);
        } finally {
          setLoading(false);
        }
      }}
      className="space-y-6"
    >
      <input type="hidden" name="assignmentId" value={assignmentId} />
      
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Keputusan (Verdict) <span className="text-red-500">*</span></label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SCREENING_VERDICTS.map(v => (
            <label key={v} className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 focus-within:ring-2 focus-within:ring-indigo-500">
              <input type="radio" name="verdict" value={v} className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" required />
              <span className="ml-3 text-sm font-medium text-gray-900 capitalize">{v.replace('_', ' ')}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Catatan Screening <span className="text-red-500">*</span></label>
        <textarea
          name="notes"
          required
          rows={4}
          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
          placeholder="Tuliskan justifikasi detail mengapa Anda memilih verdict tersebut..."
        ></textarea>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Rekomendasi (Opsional)</label>
        <textarea
          name="recommendation"
          rows={3}
          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
          placeholder="Adakah saran pengembangan untuk proposal ini ke depannya?"
        ></textarea>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#0A4736] text-white py-3 px-4 rounded-xl font-bold hover:bg-[#073629] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0A4736] transition-colors disabled:opacity-50"
      >
        {loading ? 'Menyimpan...' : 'Submit Keputusan'}
      </button>
    </form>
  );
}
