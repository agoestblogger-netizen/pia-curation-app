'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { submitRegionalAssessmentAction, saveRegionalJudgeNotesAction } from '@/app/actions/regional-final-judging';

type Assessment = {
  paramProblemFit: number;
  paramDampak: number;
  paramKelayakan: number;
  paramProfessional: number;
};

const getLevelForScore = (score: number) => {
  if (!score) return null;
  if (score >= 90) return 4;
  if (score >= 80) return 3;
  if (score >= 60) return 2;
  return 1;
};

const getBoundsForLevel = (levelNum: number) => {
  if (levelNum === 4) return { min: 90, max: 100 };
  if (levelNum === 3) return { min: 80, max: 89 };
  if (levelNum === 2) return { min: 60, max: 79 };
  return { min: 0, max: 59 };
};

const getRandomScoreForLevel = (levelNum: number) => {
  const { min, max } = getBoundsForLevel(levelNum);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const RUBRIC = {
  paramProblemFit: {
    title: 'Problem & Solution Fit',
    levels: [
      { levelNum: 4, score: 95, label: 'Level 4 (Sangat Kuat)', desc: 'Pada Masalah: Tim menunjukkan pemahaman yang mendalam dan berbasis data (kuantitatif & kualitatif) tentang akar penyebab masalah. Mereka bisa menunjukkan mengapa masalah itu penting dan untuk siapa. Pada Solusi: Solusi langsung menargetkan akar penyebab yang telah diidentifikasi. Setiap fitur solusi dapat ditelusuri kembali untuk menjawab insight spesifik dari penelitian masalah. Terasa sangat spesifik.' },
      { levelNum: 3, score: 85, label: 'Level 3 (Kuat)', desc: 'Pada Masalah: Masalah didefinisikan dengan jelas dan masuk akal, berdasarkan observasi atau wawasan yang logis (meski data pendukung mungkin terbatas). Pada Solusi: Solusi yang ditawarkan secara logis terkait dengan masalah yang dijelaskan. Meskipun tidak sepenuhnya inovatif, solusi tersebut merupakan respons yang masuk akal.' },
      { levelNum: 2, score: 70, label: 'Level 2 (Cukup)', desc: 'Pada Masalah: Masalah yang diangkat bersifat umum dan terlalu luas (contoh: "komunikasi tidak efektif") tanpa penjelasan yang mendalam atau spesifik konteks. Pada Solusi: Solusi yang diberikan sudah ada atau umum. Hubungan antara fitur solusi dan masalah terasa longgar dan tidak spesifik.' },
      { levelNum: 1, score: 50, label: 'Level 1 (Lemah)', desc: 'Pada Masalah: Masalah tidak dijelaskan dengan baik, tidak relevan dengan konteks, atau terasa dipaksakan. Pada Solusi: Tidak ada hubungan yang jelas antara solusi yang dipresentasikan dengan masalah yang disebutkan. Seolah-olah tim punya solusi yang sudah jadi, lalu mencari-cari masalah untuknya.' },
    ]
  },
  paramDampak: {
    title: 'Dampak terhadap Produktivitas',
    levels: [
      { levelNum: 4, score: 95, label: 'Level 4 (Transformatif)', desc: 'Inovasi berpotensi mengubah cara kerja secara fundamental. Dampaknya luas, menyentuh banyak divisi atau proses inti, dan peningkatan produktivitasnya sangat signifikan (>30% penghematan waktu/sumber daya).' },
      { levelNum: 3, score: 85, label: 'Level 3 (Signifikan)', desc: 'Inovasi memberikan peningkatan yang jelas dan terukur untuk suatu proses atau tim. Dampaknya penting dan langsung dirasakan oleh target Inovasi.' },
      { levelNum: 2, score: 70, label: 'Level 2 (Marginal)', desc: 'Inovasi memberikan peningkatan yang kecil atau bersifat incremental. Solusinya membantu, tetapi tidak mengubah game secara signifikan.' },
      { levelNum: 1, score: 50, label: 'Level 1 (Minimal)', desc: 'Dampak pada produktivitas tidak jelas, tidak terukur, atau diragukan.' },
    ]
  },
  paramKelayakan: {
    title: 'Kelayakan & Skalabilitas',
    levels: [
      { levelNum: 4, score: 95, label: 'Level 4 (Siap & Scalable)', desc: 'Solusi sangat realistis untuk diimplementasikan segera dengan biaya rendah. Mudah diadopsi dan memiliki potensi yang jelas untuk diterapkan di seluruh bagian perusahaan (scalable).' },
      { levelNum: 3, score: 85, label: 'Level 3 (Praktis)', desc: 'Solusi realistis untuk diimplementasikan dalam waktu dekat, tetapi mungkin membutuhkan sedikit sumber daya (modal, waktu, atau training) atau berlaku untuk divisi tertentu terlebih dahulu.' },
      { levelNum: 2, score: 70, label: 'Level 2 (Kompleks)', desc: 'Implementasi solusi membutuhkan effort yang signifikan (investasi besar, perubahan proses utama, atau integrasi sistem yang rumit).' },
      { levelNum: 1, score: 50, label: 'Level 1 (Tidak Praktis)', desc: 'Solusi tidak realistis untuk diwujudkan di perusahaan dalam kondisi saat ini karena keterbatasan teknis, finansial, atau budaya.' },
    ]
  },
  paramProfessional: {
    title: 'Professional Judgement',
    levels: [
      { levelNum: 4, score: 95, label: 'Level 4 (Must Have)', desc: 'Ide ini merupakan prioritas perusahaan dan dapat membantu akselerasi pencapaian kinerja.' },
      { levelNum: 3, score: 85, label: 'Level 3 (Should Have)', desc: 'Ide ini mampu melengkapi proses perusahaan yang telah berjalan.' },
      { levelNum: 2, score: 70, label: 'Level 2 (Could Have)', desc: 'Ide ini bagus jika diimplementasikan namun tidak menjadi prioritas perusahaan.' },
      { levelNum: 1, score: 50, label: 'Level 1 (Won\'t Have)', desc: 'Ide ini belum relevan dengan nilai-nilai perusahaan.' },
    ]
  }
};

type LevelScores = {
  paramProblemFit: Record<number, number>;
  paramDampak: Record<number, number>;
  paramKelayakan: Record<number, number>;
  paramProfessional: Record<number, number>;
};

export default function RegionalAssessClient({
  sessionId,
  proposalId,
  existingAssessment,
  prevId,
  nextId,
  currentIndex,
  totalProposals,
  isFinalized = false
}: {
  sessionId: number;
  proposalId: number;
  existingAssessment: any;
  prevId: number | null;
  nextId: number | null;
  currentIndex: number;
  totalProposals: number;
  isFinalized?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeLevels, setActiveLevels] = useState<{
    paramProblemFit: number | null;
    paramDampak: number | null;
    paramKelayakan: number | null;
    paramProfessional: number | null;
  }>({
    paramProblemFit: getLevelForScore(existingAssessment?.paramProblemFit || 0),
    paramDampak: getLevelForScore(existingAssessment?.paramDampak || 0),
    paramKelayakan: getLevelForScore(existingAssessment?.paramKelayakan || 0),
    paramProfessional: getLevelForScore(existingAssessment?.paramProfessional || 0),
  });

  const getInitialScores = (existingScore: number) => {
    const scores: Record<number, number> = {
      1: getRandomScoreForLevel(1),
      2: getRandomScoreForLevel(2),
      3: getRandomScoreForLevel(3),
      4: getRandomScoreForLevel(4),
    };
    const lvl = getLevelForScore(existingScore);
    if (lvl && existingScore > 0) {
      scores[lvl] = existingScore;
    }
    return scores;
  };

  const [levelScores, setLevelScores] = useState<LevelScores>({
    paramProblemFit: getInitialScores(existingAssessment?.paramProblemFit || 0),
    paramDampak: getInitialScores(existingAssessment?.paramDampak || 0),
    paramKelayakan: getInitialScores(existingAssessment?.paramKelayakan || 0),
    paramProfessional: getInitialScores(existingAssessment?.paramProfessional || 0),
  });

  const [saveStatus, setSaveStatus] = useState('');

  // Notes state & auto-save setup (debounce ~2s + onBlur)
  const [notes, setNotes] = useState<string>(existingAssessment?.notes || '');
  const [notesSaveStatus, setNotesSaveStatus] = useState<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedNotesRef = useRef<string>(existingAssessment?.notes || '');

  const handleSaveNotes = (newNotesText: string) => {
    if (newNotesText === lastSavedNotesRef.current || isFinalized) return;
    setNotesSaveStatus('Menyimpan catatan...');
    startTransition(async () => {
      let res;
      if (isComplete) {
        res = await submitRegionalAssessmentAction(
          sessionId,
          proposalId,
          {
            problemFit: finalScores.paramProblemFit,
            dampak: finalScores.paramDampak,
            kelayakan: finalScores.paramKelayakan,
            professional: finalScores.paramProfessional
          },
          newNotesText
        );
      } else {
        res = await saveRegionalJudgeNotesAction(sessionId, proposalId, newNotesText);
      }

      if (res.success) {
        lastSavedNotesRef.current = newNotesText;
        setNotesSaveStatus('Catatan tersimpan ✓');
        router.refresh();
        setTimeout(() => setNotesSaveStatus(''), 2500);
      } else {
        setNotesSaveStatus('Gagal menyimpan catatan');
      }
    });
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotes(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      handleSaveNotes(val);
    }, 2000);
  };

  const handleNotesBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    handleSaveNotes(notes);
  };

  const finalScores = {
    paramProblemFit: activeLevels.paramProblemFit ? levelScores.paramProblemFit[activeLevels.paramProblemFit] : 0,
    paramDampak: activeLevels.paramDampak ? levelScores.paramDampak[activeLevels.paramDampak] : 0,
    paramKelayakan: activeLevels.paramKelayakan ? levelScores.paramKelayakan[activeLevels.paramKelayakan] : 0,
    paramProfessional: activeLevels.paramProfessional ? levelScores.paramProfessional[activeLevels.paramProfessional] : 0,
  };

  const totalScore = finalScores.paramProblemFit + finalScores.paramDampak + finalScores.paramKelayakan + finalScores.paramProfessional;
  const isComplete = activeLevels.paramProblemFit && activeLevels.paramDampak && activeLevels.paramKelayakan && activeLevels.paramProfessional;
  const averageScore = isComplete ? (totalScore / 4) : 0;

  const handleSave = () => {
    if (!isComplete || isFinalized) return;
    setSaveStatus('Menyimpan...');
    startTransition(async () => {
      const res = await submitRegionalAssessmentAction(
        sessionId,
        proposalId,
        {
          problemFit: finalScores.paramProblemFit,
          dampak: finalScores.paramDampak,
          kelayakan: finalScores.paramKelayakan,
          professional: finalScores.paramProfessional
        },
        notes
      );
      if (res.success) {
        setSaveStatus('Tersimpan ✓');
        router.refresh();
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus('Gagal menyimpan');
      }
    });
  };

  const handleScoreBlur = (key: keyof Assessment, levelNum: number) => {
    const { min, max } = getBoundsForLevel(levelNum);
    setLevelScores(s => {
      let val = s[key][levelNum];
      if (val < min) val = min;
      if (val > max) val = max;
      return { ...s, [key]: { ...s[key], [levelNum]: val } };
    });
  };

  const renderParam = (key: keyof Assessment, rubricData: any) => (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900 mb-4">{rubricData.title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {rubricData.levels.map((level: any) => {
          const isSelected = activeLevels[key] === level.levelNum;
          let colors = { active: '', hover: '', dotSelected: '', dotUnselected: '', textSelected: '' };
          if (level.levelNum === 1) colors = { active: 'border-orange-500 bg-orange-50 ring-1 ring-orange-500 shadow-md', hover: 'border-gray-200 hover:border-orange-400 hover:bg-orange-50/50', dotSelected: 'bg-orange-500 text-white', dotUnselected: 'bg-orange-100 text-orange-600', textSelected: 'text-orange-900' };
          else if (level.levelNum === 2) colors = { active: 'border-yellow-500 bg-yellow-50 ring-1 ring-yellow-500 shadow-md', hover: 'border-gray-200 hover:border-yellow-400 hover:bg-yellow-50/50', dotSelected: 'bg-yellow-500 text-white', dotUnselected: 'bg-yellow-100 text-yellow-700', textSelected: 'text-yellow-900' };
          else if (level.levelNum === 3) colors = { active: 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 shadow-md', hover: 'border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/50', dotSelected: 'bg-emerald-500 text-white', dotUnselected: 'bg-emerald-100 text-emerald-600', textSelected: 'text-emerald-900' };
          else if (level.levelNum === 4) colors = { active: 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-md', hover: 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50', dotSelected: 'bg-blue-600 text-white', dotUnselected: 'bg-blue-100 text-blue-600', textSelected: 'text-blue-900' };

          const { min, max } = getBoundsForLevel(level.levelNum);
          const currentLevelScore = levelScores[key][level.levelNum];

          return (
            <div
              key={level.score}
              onClick={() => {
                if (!isSelected && !isFinalized) {
                  setActiveLevels(s => ({ ...s, [key]: level.levelNum }));
                }
              }}
              className={`p-4 rounded-xl border-2 transition-all ${
                isSelected ? colors.active : `cursor-pointer ${isFinalized ? 'opacity-60 cursor-default' : colors.hover}`
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <div className={`font-bold ${isSelected ? colors.textSelected : 'text-gray-800'}`}>
                  {level.label}
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  isSelected ? colors.dotSelected : colors.dotUnselected
                }`}>
                  {currentLevelScore || level.score}
                </div>
              </div>
              <p className={`text-sm leading-relaxed ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                {level.desc}
              </p>
              
              {isSelected && !isFinalized && (
                <div className="mt-4 pt-4 border-t border-gray-200/50">
                  <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${colors.textSelected}`}>
                    Skor Spesifik ({min}-{max})
                  </label>
                  <input 
                    type="number"
                    min={min}
                    max={max}
                    value={currentLevelScore || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setLevelScores(s => ({
                        ...s,
                        [key]: { ...s[key], [level.levelNum]: isNaN(val) ? 0 : val }
                      }));
                    }}
                    onBlur={() => handleScoreBlur(key, level.levelNum)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-900"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 bg-white p-4 border-b border-gray-200 shadow-sm rounded-xl flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-base font-semibold text-gray-500 tracking-wide uppercase">Rata-rata Skor</span>
          <div className="flex items-center space-x-4 mt-1">
            <span className="text-4xl font-extrabold text-gray-900">{isComplete ? averageScore.toFixed(2) : '-'}</span>
            {isComplete && (
              <button 
                onClick={handleSave}
                disabled={isPending || isFinalized}
                className={`px-6 py-2 rounded-lg font-bold text-sm uppercase tracking-wider transition-colors shadow-sm ${
                  isPending || isFinalized ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {isPending ? 'Menyimpan...' : (isFinalized ? 'Terkunci' : 'Simpan Penilaian')}
              </button>
            )}
            <span className={`text-sm font-medium ml-2 ${saveStatus.includes('Gagal') ? 'text-red-500' : 'text-green-600'}`}>{saveStatus}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500 font-medium">
            Proposal {currentIndex} / {totalProposals}
          </div>
          {prevId ? (
            <Link href={`/regional-judge/assess/${sessionId}?proposalId=${prevId}`} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium transition-colors">
              ◀ Sebelumnya
            </Link>
          ) : (
            <button disabled className="px-4 py-2 bg-gray-50 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed">
              ◀ Sebelumnya
            </button>
          )}
          {nextId ? (
            <Link href={`/regional-judge/assess/${sessionId}?proposalId=${nextId}`} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
              Selanjutnya ▶
            </Link>
          ) : (
            <button disabled className="px-4 py-2 bg-gray-50 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed">
              Selanjutnya ▶
            </button>
          )}
        </div>
      </div>

      {isFinalized && (
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3 shadow-sm">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-900">Nilai Sudah Difinalisasi</p>
            <p className="text-sm text-blue-700 mt-1">Anda tidak dapat mengubah nilai lagi karena Anda telah mengklik "Finalisasi Nilai Saya" pada Sidang Penetapan.</p>
          </div>
        </div>
      )}

      {renderParam('paramProblemFit', RUBRIC.paramProblemFit)}
      {renderParam('paramDampak', RUBRIC.paramDampak)}
      {renderParam('paramKelayakan', RUBRIC.paramKelayakan)}
      {renderParam('paramProfessional', RUBRIC.paramProfessional)}
      
      {/* Catatan Juri (opsional) */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Catatan Juri <span className="text-xs font-normal text-gray-400">(opsional)</span></h3>
            <p className="text-xs text-gray-500 mt-0.5">Catatan kualitatif atau pertimbangan tambahan mengenai proposal ini (tersimpan otomatis & tampil saat Sidang Penetapan Regional).</p>
          </div>
          {notesSaveStatus && (
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
              notesSaveStatus.includes('tersimpan') ? 'bg-green-100 text-green-800 border border-green-200' :
              notesSaveStatus.includes('Gagal') ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
            }`}>
              {notesSaveStatus}
            </span>
          )}
        </div>
        <textarea
          value={notes}
          onChange={handleNotesChange}
          onBlur={handleNotesBlur}
          disabled={isFinalized}
          placeholder="Tuliskan catatan kualitatif atau pertimbangan khusus untuk proposal ini..."
          rows={4}
          className="w-full p-3.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-y text-gray-900 placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      <div className="pb-12 flex justify-end">
        {isComplete && (
          <button 
            onClick={handleSave}
            disabled={isPending || isFinalized}
            className={`px-8 py-3 rounded-xl font-bold text-base uppercase tracking-wider transition-all shadow-md ${
              isPending || isFinalized ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-lg'
            }`}
          >
            {isPending ? 'Menyimpan...' : (isFinalized ? 'Terkunci' : 'Simpan Penilaian')}
          </button>
        )}
      </div>
    </div>
  );
}
