'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { saveSponsorAssessmentAction, saveSponsorNotesAction } from '@/app/actions/grand-final';

type Assessment = {
  param1Score: number;
  param2Score: number;
  param3Score: number;
  param4Score: number;
};

const RUBRIC = {
  param1: {
    title: 'Problem & Solution Fit',
    levels: [
      { score: 4, label: 'Level 4 (Sangat Kuat)', desc: 'Tim menunjukkan pemahaman mendalam berbasis data (kuantitatif & kualitatif) tentang akar masalah. Solusi langsung menargetkan akar penyebab, tiap fitur bisa ditelusuri ke insight spesifik.' },
      { score: 3, label: 'Level 3 (Kuat)', desc: 'Masalah didefinisikan jelas dan masuk akal. Solusi terkait logis dengan masalah, meski tidak sepenuhnya inovatif.' },
      { score: 2, label: 'Level 2 (Cukup)', desc: 'Masalah terlalu umum/luas tanpa penjelasan mendalam. Solusi sudah ada/umum, hubungan solusi-masalah longgar.' },
      { score: 1, label: 'Level 1 (Lemah)', desc: 'Masalah tidak dijelaskan baik/tidak relevan. Tidak ada hubungan jelas solusi-masalah (solusi duluan, cari-cari masalah).' },
    ]
  },
  param2: {
    title: 'Impact',
    levels: {
      'BC': [
        { score: 4, label: 'Level 4 (Game-Changing Quick Win)', desc: 'Potensi tarik nasabah jumlah besar (>10% growth) dalam <1 bulan. Effort teknis minimal, mekanisme "no-brainer", conversion rate tinggi.' },
        { score: 3, label: 'Level 3 (High-Impact Quick Win)', desc: 'Peningkatan signifikan (5-10% growth), implementasi cepat (1-3 bulan). Pakai infrastruktur ada, ROI jelas & cepat.' },
        { score: 2, label: 'Level 2 (Tactical Move)', desc: 'Dampak kecil-moderat. Implementasi cepat (<3 bulan) tapi hasil incremental (<5% growth). Optimasi taktis.' },
        { score: 1, label: 'Level 1 (Not a Quick Win)', desc: 'Dampak tidak jelas. Implementasi panjang (>6 bulan), kompleks. Butuh investasi besar.' },
      ],
      'BI': [
        { score: 4, label: 'Level 4 (Transformational)', desc: 'Ciptakan aliran pendapatan baru signifikan/buka pasar baru. Ubah model bisnis jadi berkelanjutan (circular economy/net-zero), keunggulan kompetitif jangka panjang.' },
        { score: 3, label: 'Level 3 (Significant Growth)', desc: 'Perkuat pendapatan existing secara jelas (fitur premium). Tingkatkan efisiensi sumber daya, kurangi biaya operasional.' },
        { score: 2, label: 'Level 2 (Incremental)', desc: 'Kontribusi tambahan kecil (<5%). Dampak keberlanjutan terbatas, lebih ke compliance daripada nilai bisnis.' },
        { score: 1, label: 'Level 1 (Unclear)', desc: 'Tidak jelas/tidak terukur/tidak ada, tanpa proposisi monetisasi yang dipahami. Tidak ada dampak keberlanjutan.' },
      ]
    }
  },
  param3: {
    title: 'Kelayakan & Skalabilitas',
    levels: [
      { score: 4, label: 'Level 4 (Siap & Scalable)', desc: 'Solusi sangat realistis diimplementasikan segera dengan biaya rendah, mudah diadopsi, potensi diterapkan di seluruh bagian perusahaan.' },
      { score: 3, label: 'Level 3 (Praktis)', desc: 'Solusi realistis diimplementasikan dalam waktu dekat, tapi mungkin butuh sedikit sumber daya atau berlaku divisi tertentu dulu.' },
      { score: 2, label: 'Level 2 (Kompleks)', desc: 'Implementasi butuh effort signifikan (investasi besar, perubahan proses utama, integrasi sistem rumit).' },
      { score: 1, label: 'Level 1 (Tidak Praktis)', desc: 'Solusi tidak realistis diwujudkan saat ini karena keterbatasan teknis/finansial/budaya.' },
    ]
  },
  param4: {
    title: 'Professional Judgement',
    levels: [
      { score: 4, label: 'Level 4 (Must Have)', desc: 'Ide ini prioritas perusahaan, bantu akselerasi pencapaian kinerja.' },
      { score: 3, label: 'Level 3 (Should Have)', desc: 'Ide melengkapi proses perusahaan yang sudah berjalan.' },
      { score: 2, label: 'Level 2 (Could Have)', desc: 'Ide bagus kalau diimplementasikan, tapi bukan prioritas perusahaan.' },
      { score: 1, label: 'Level 1 (Won\'t Have)', desc: 'Ide belum relevan dengan nilai-nilai perusahaan.' },
    ]
  }
};

export default function AssessClient({
  competitionId,
  proposalId,
  category,
  existingAssessment,
  prevId,
  nextId,
  currentIndex,
  totalProposals
}: {
  competitionId: number;
  proposalId: number;
  category: 'BC' | 'BI';
  existingAssessment: any;
  prevId: number | null;
  nextId: number | null;
  currentIndex: number;
  totalProposals: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [scores, setScores] = useState<Assessment>({
    param1Score: existingAssessment?.param1Score || 0,
    param2Score: existingAssessment?.param2Score || 0,
    param3Score: existingAssessment?.param3Score || 0,
    param4Score: existingAssessment?.param4Score || 0,
  });
  const [saveStatus, setSaveStatus] = useState('');

  // Notes state & auto-save setup
  const [notes, setNotes] = useState<string>(existingAssessment?.notes || '');
  const [notesSaveStatus, setNotesSaveStatus] = useState<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedNotesRef = useRef<string>(existingAssessment?.notes || '');

  const handleSaveNotes = (newNotesText: string) => {
    if (newNotesText === lastSavedNotesRef.current) return;
    setNotesSaveStatus('Menyimpan catatan...');
    startTransition(async () => {
      let res;
      if (scores.param1Score && scores.param2Score && scores.param3Score && scores.param4Score) {
        res = await saveSponsorAssessmentAction(
          competitionId,
          proposalId,
          scores.param1Score,
          scores.param2Score,
          scores.param3Score,
          scores.param4Score,
          newNotesText
        );
      } else {
        res = await saveSponsorNotesAction(competitionId, proposalId, newNotesText);
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

  // Auto-save logic for scores
  useEffect(() => {
    if (scores.param1Score && scores.param2Score && scores.param3Score && scores.param4Score) {
      setSaveStatus('Menyimpan...');
      startTransition(async () => {
        const res = await saveSponsorAssessmentAction(
          competitionId,
          proposalId,
          scores.param1Score,
          scores.param2Score,
          scores.param3Score,
          scores.param4Score,
          notes
        );
        if (res.success) {
          setSaveStatus('Tersimpan otomatis ✓');
          router.refresh();
          setTimeout(() => setSaveStatus(''), 2000);
        } else {
          setSaveStatus('Gagal menyimpan');
        }
      });
    }
  }, [scores, competitionId, proposalId]);

  const totalScore = scores.param1Score + scores.param2Score + scores.param3Score + scores.param4Score;
  let classification = 'Belum Lengkap';
  if (scores.param1Score && scores.param2Score && scores.param3Score && scores.param4Score) {
    if (totalScore >= 14) classification = 'Diamond';
    else if (totalScore >= 12) classification = 'Platinum';
    else if (totalScore >= 9) classification = 'Gold';
    else if (totalScore >= 7) classification = 'Silver';
    else classification = 'Bronze';
  }

  const renderParam = (key: keyof Assessment, rubricData: any) => (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900 mb-4">{rubricData.title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {rubricData.levels.map((level: any) => {
          const isSelected = scores[key] === level.score;
          let colors = { active: '', hover: '', dotSelected: '', dotUnselected: '', textSelected: '' };
          if (level.score === 1) colors = { active: 'border-orange-500 bg-orange-50 ring-1 ring-orange-500 shadow-md', hover: 'border-gray-200 hover:border-orange-400 hover:bg-orange-50/50', dotSelected: 'bg-orange-500 text-white', dotUnselected: 'bg-orange-100 text-orange-600', textSelected: 'text-orange-900' };
          else if (level.score === 2) colors = { active: 'border-yellow-500 bg-yellow-50 ring-1 ring-yellow-500 shadow-md', hover: 'border-gray-200 hover:border-yellow-400 hover:bg-yellow-50/50', dotSelected: 'bg-yellow-500 text-white', dotUnselected: 'bg-yellow-100 text-yellow-700', textSelected: 'text-yellow-900' };
          else if (level.score === 3) colors = { active: 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 shadow-md', hover: 'border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/50', dotSelected: 'bg-emerald-500 text-white', dotUnselected: 'bg-emerald-100 text-emerald-600', textSelected: 'text-emerald-900' };
          else if (level.score === 4) colors = { active: 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-md', hover: 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50', dotSelected: 'bg-blue-600 text-white', dotUnselected: 'bg-blue-100 text-blue-600', textSelected: 'text-blue-900' };

          return (
            <div
              key={level.score}
              onClick={() => setScores(s => ({ ...s, [key]: level.score }))}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                isSelected ? colors.active : colors.hover
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <div className={`font-bold ${isSelected ? colors.textSelected : 'text-gray-800'}`}>
                  {level.label}
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  isSelected ? colors.dotSelected : colors.dotUnselected
                }`}>
                  {level.score}
                </div>
              </div>
              <p className={`text-sm leading-relaxed ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                {level.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 bg-white p-4 border-b border-gray-200 shadow-sm rounded-xl flex justify-between items-center">
        <div>
          <span className="text-base font-semibold text-gray-500 tracking-wide uppercase">Total Skor</span>
          <div className="flex items-center space-x-4 mt-1">
            <span className="text-4xl font-extrabold text-gray-900">{totalScore}</span>
            {classification !== 'Belum Lengkap' && (
              <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest shadow-sm
                ${classification === 'Diamond' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                  classification === 'Platinum' ? 'bg-gray-200 text-gray-800 border border-gray-300' :
                  classification === 'Gold' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                  classification === 'Silver' ? 'bg-gray-100 text-gray-600 border border-gray-300' :
                  'bg-orange-100 text-orange-800 border border-orange-200'}`}
              >
                {classification}
              </span>
            )}
            <span className="text-sm text-gray-400 font-medium ml-2">{saveStatus}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500 font-medium">
            Proposal {currentIndex} / {totalProposals}
          </div>
          {prevId ? (
            <Link href={`/sponsor/assess/${prevId}`} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium transition-colors">
              ◀ Sebelumnya
            </Link>
          ) : (
            <button disabled className="px-4 py-2 bg-gray-50 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed">
              ◀ Sebelumnya
            </button>
          )}
          {nextId ? (
            <Link href={`/sponsor/assess/${nextId}`} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
              Selanjutnya ▶
            </Link>
          ) : (
            <button disabled className="px-4 py-2 bg-gray-50 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed">
              Selanjutnya ▶
            </button>
          )}
        </div>
      </div>

      {renderParam('param1Score', RUBRIC.param1)}
      {renderParam('param2Score', { ...RUBRIC.param2, levels: RUBRIC.param2.levels[category] || RUBRIC.param2.levels['BC'] })}
      {renderParam('param3Score', RUBRIC.param3)}
      {renderParam('param4Score', RUBRIC.param4)}
      
      {/* Catatan Juri (opsional) */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Catatan Juri <span className="text-xs font-normal text-gray-400">(opsional)</span></h3>
            <p className="text-xs text-gray-500 mt-0.5">Catatan kualitatif atau pertimbangan tambahan mengenai proposal ini (tersimpan otomatis & tampil saat Kalibrasi Sidang Penetapan).</p>
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
          placeholder="Tuliskan catatan kualitatif atau pertimbangan khusus untuk proposal ini..."
          rows={4}
          className="w-full p-3.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-y text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <div className="pb-12" />
    </div>
  );
}
