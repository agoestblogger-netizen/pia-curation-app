'use client';

import { useState } from 'react';
import { submitScreeningAction, editScreeningAction, resetScreeningAction } from '@/app/actions/screening';
import { SCREENING_VERDICTS } from '@/lib/constants/screening';

type ScreeningFormProps = {
  assignmentId: number;
  isCompleted: boolean;
  hardLock?: { locked: boolean; reason: string };
  existingResult?: { verdict: string; notes: string };
};

export default function ScreeningForm({ assignmentId, isCompleted, hardLock, existingResult }: ScreeningFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleReset = async () => {
    if (!confirm('Anda yakin ingin membatalkan/reset screening ini? Proposal akan kembali ke status awal (belum discreening).')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await resetScreeningAction(assignmentId);
      if (res.error) setError(res.error);
    } finally {
      setLoading(false);
    }
  };

  if (isCompleted && !isEditing) {
    return (
      <div className="bg-green-50 text-green-800 p-4 rounded-xl border border-green-200">
        <div className="flex items-center mb-2">
          ✅ <span className="ml-2 font-semibold">Screening Selesai</span>
        </div>
        {existingResult && (
          <div className="mt-3 text-sm bg-white p-3 rounded-lg border border-green-100">
            <p className="mb-1"><span className="font-semibold text-gray-700">Verdict:</span> <span className="capitalize text-indigo-700 font-bold">{existingResult.verdict.replace('_', ' ')}</span></p>
            <p><span className="font-semibold text-gray-700">Catatan:</span> {existingResult.notes}</p>
          </div>
        )}
        
        {hardLock?.locked ? (
          <div className="mt-4 text-xs font-semibold text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
            🔒 {hardLock.reason}
          </div>
        ) : (
          <div className="mt-4 flex space-x-3">
            <button 
              type="button" 
              onClick={() => setIsEditing(true)}
              className="text-sm px-3 py-1.5 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-50 shadow-sm transition"
            >
              Edit Verdict
            </button>
            <button 
              type="button" 
              onClick={handleReset}
              disabled={loading}
              className="text-sm px-3 py-1.5 bg-red-50 border border-red-200 rounded text-red-600 hover:bg-red-100 shadow-sm transition disabled:opacity-50"
            >
              {loading ? 'Memproses...' : 'Reset Screening'}
            </button>
          </div>
        )}
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>
    );
  }

  return (
    <form 
      action={async (formData) => {
        setLoading(true);
        setError(null);
        try {
          const res = isEditing 
            ? await editScreeningAction({}, formData)
            : await submitScreeningAction({}, formData);
            
          if (res.error) {
            setError(res.error);
          } else if (isEditing) {
            setIsEditing(false);
          }
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
              <input type="radio" name="verdict" value={v} defaultChecked={isEditing && existingResult?.verdict === v} className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" required />
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
          defaultValue={isEditing ? existingResult?.notes : ''}
          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border text-gray-900 bg-white"
          placeholder="Tuliskan justifikasi detail mengapa Anda memilih verdict tersebut..."
        ></textarea>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Rekomendasi (Opsional)</label>
        <textarea
          name="recommendation"
          rows={3}
          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border text-gray-900 bg-white"
          placeholder="Adakah saran pengembangan untuk proposal ini ke depannya?"
        ></textarea>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-4">
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto bg-[#0A4736] text-white py-3 px-6 rounded-xl font-bold hover:bg-[#073629] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0A4736] transition-colors disabled:opacity-50"
        >
          {loading ? 'Proses simpan.......' : (isEditing ? 'Simpan Perubahan' : 'Submit Keputusan')}
        </button>
        {isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            disabled={loading}
            className="w-full sm:w-auto bg-white border border-gray-300 text-gray-700 py-3 px-6 rounded-xl font-bold hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 transition-colors disabled:opacity-50"
          >
            Batal Edit
          </button>
        )}
      </div>

      {loading && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white px-8 py-5 rounded-2xl shadow-xl flex items-center space-x-4">
            <svg className="animate-spin h-6 w-6 text-[#0A4736]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-gray-900 font-bold text-lg">Sedang memproses...</span>
          </div>
        </div>
      )}
    </form>
  );
}
