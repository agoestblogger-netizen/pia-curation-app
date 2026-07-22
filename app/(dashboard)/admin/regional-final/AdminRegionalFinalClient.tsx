'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { assignRegionalJudgesAction } from '@/app/actions/regional-final-judging';

type Session = {
  id: number;
  region: string;
  status: string;
  juriCountSetting: number;
  pic: { id: number; name: string } | null;
  judges: { id: number; name: string }[];
};

export default function AdminRegionalFinalClient({
  sessions,
  availableUsers,
}: {
  sessions: Session[];
  availableUsers: { id: number; name: string; email: string }[];
}) {
  const router = useRouter();
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [selectedPicId, setSelectedPicId] = useState<number | null>(null);
  const [selectedJudges, setSelectedJudges] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleEdit = (session: Session) => {
    setEditingSessionId(session.id);
    setSelectedPicId(session.pic?.id || null);
    setSelectedJudges(session.judges.map(j => j.id));
    setError('');
  };

  const toggleJudge = (judgeId: number) => {
    setSelectedJudges(prev => 
      prev.includes(judgeId) 
        ? prev.filter(id => id !== judgeId)
        : [...prev, judgeId]
    );
  };

  const handleSave = async (sessionId: number) => {
    setIsSubmitting(true);
    setError('');
    try {
      const res = await assignRegionalJudgesAction(sessionId, selectedJudges, selectedPicId);
      if (res?.error) {
        setError(res.error);
      } else {
        setEditingSessionId(null);
        router.refresh();
      }
    } catch (e: any) {
      setError(e.message || 'Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string, color: string }> = {
      'finalis_terkunci': { label: 'Menunggu Juri', color: 'bg-gray-100 text-gray-800' },
      'juri_ditugaskan': { label: 'Juri Ditugaskan', color: 'bg-blue-100 text-blue-800' },
      'penilaian_dibuka': { label: 'Penilaian Dibuka', color: 'bg-yellow-100 text-yellow-800' },
      'penilaian_selesai': { label: 'Penilaian Selesai', color: 'bg-orange-100 text-orange-800' },
      'sidang_penetapan': { label: 'Sidang Penetapan', color: 'bg-purple-100 text-purple-800' },
      'hasil_terkunci': { label: 'Selesai (Locked)', color: 'bg-green-100 text-green-800' },
    };
    
    const config = statusConfig[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return <span className={`px-2 py-1 text-xs rounded-full font-medium ${config.color}`}>{config.label}</span>;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
            <tr>
              <th className="px-6 py-4">Grup Regional</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">PIC & Juri Regional ({availableUsers.length} Tersedia)</th>
              <th className="px-6 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sessions.map(s => {
              const isEditing = editingSessionId === s.id;
              const canEdit = s.status === 'finalis_terkunci' || s.status === 'juri_ditugaskan';
              
              return (
                <tr key={s.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 font-semibold text-gray-900">{s.region}</td>
                  <td className="px-6 py-4">{getStatusBadge(s.status)}</td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Pilih PIC Regional (1 Orang)</div>
                          <select 
                            value={selectedPicId || ''} 
                            onChange={(e) => setSelectedPicId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          >
                            <option value="">-- Pilih PIC --</option>
                            {availableUsers.map(u => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <div className="text-xs text-gray-500 mb-2">Pilih Juri (Target: {s.juriCountSetting} orang)</div>
                          <div className="max-h-48 overflow-y-auto space-y-1 p-2 border rounded-lg bg-white">
                            {availableUsers.map(judge => (
                              <label key={judge.id} className="flex items-center space-x-2 p-1.5 hover:bg-indigo-50 rounded cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={selectedJudges.includes(judge.id)}
                                  onChange={() => toggleJudge(judge.id)}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                />
                                <span className="text-sm">{judge.name}</span>
                              </label>
                            ))}
                            {availableUsers.length === 0 && (
                              <div className="text-sm text-gray-500 italic p-2">Belum ada akun dengan role "regional".</div>
                            )}
                          </div>
                        </div>
                        {error && <div className="text-xs text-red-600 font-medium mt-1">{error}</div>}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-semibold w-8">PIC:</span>
                          {s.pic ? (
                            <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-md font-medium border border-green-100">
                              {s.pic.name}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic text-xs">Belum di-assign</span>
                          )}
                        </div>
                        
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-gray-500 font-semibold w-8 pt-1">Juri:</span>
                          <div className="flex flex-wrap gap-1">
                            {s.judges.length > 0 ? (
                              s.judges.map(j => (
                                <span key={j.id} className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-md font-medium border border-indigo-100">
                                  {j.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-400 italic text-xs pt-1">Belum ada juri</span>
                            )}
                            {s.judges.length > 0 && s.judges.length !== s.juriCountSetting && (
                              <span className="text-yellow-600 text-xs flex items-center ml-1" title={`Harusnya ${s.juriCountSetting} juri`}>
                                ⚠️ ({s.judges.length}/{s.juriCountSetting})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => setEditingSessionId(null)}
                          disabled={isSubmitting}
                          className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                        >
                          Batal
                        </button>
                        <button 
                          onClick={() => handleSave(s.id)}
                          disabled={isSubmitting}
                          className="px-3 py-1.5 text-sm text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                        </button>
                      </div>
                    ) : (
                      canEdit ? (
                          <button 
                            onClick={() => handleEdit(s)}
                            className="text-indigo-600 hover:text-indigo-900 font-medium text-sm"
                          >
                            Assign PIC/Juri
                          </button>
                      ) : (
                        <span className="text-gray-400 text-sm italic">Terkunci</span>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
            
            {sessions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  Tidak ada data finalis regional. (Pastikan ada proposal berstatus "regional_finalist" untuk memunculkan sesi).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
