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
      {
        score: 5,
        label: 'Level 5 (Excellent)',
        desc: 'Memahami akar masalah secara mendalam berbasis bukti. Solusi sangat spesifik menjawab akar masalah dan terbukti relevan bagi target customer/user.',
      },
      {
        score: 4,
        label: 'Level 4 (Very Good)',
        desc: 'Masalah terdefinisi spesifik dan didukung data validasi yang cukup kuat. Akar penyebab jelas. Solusi memiliki hubungan kuat dengan akar masalah dan didasarkan pada insight hasil validasi.',
      },
      {
        score: 3,
        label: 'Level 3 (Good)',
        desc: 'Masalah cukup jelas namun beberapa aspek penting belum tervalidasi sepenuhnya. Solusi menjawab sebagian besar masalah, tetapi keterkaitan dengan hasil validasi belum kuat.',
      },
      {
        score: 2,
        label: 'Level 2 (Fair)',
        desc: 'Pemahaman masalah masih umum dan bukti mendukung terbatas. Solusi yang diusulkan parsial menjawab masalah dan hubungan keduanya belum jelas.',
      },
      {
        score: 1,
        label: 'Level 1 (Poor)',
        desc: 'Masalah tidak jelas, tidak tervalidasi, atau tidak relevan. Solusi tidak menjawab masalah yang ada.',
      },
    ],
  },
  param2: {
    title: 'Impact & Kecepatan Realisasi',
    levels: [
      {
        score: 5,
        label: 'Level 5 (Excellent)',
        desc: 'Dampak sangat besar (revenue baru signifikan dan/atau aktivasi massal, growth >10%). Hasil cepat (<1 bulan) dengan memanfaatkan aset existing, tanpa investasi baru signifikan, serta menciptakan efisiensi/keunggulan kompetitif jangka panjang.',
      },
      {
        score: 4,
        label: 'Level 4 (Very Good)',
        desc: 'Dampak besar (growth 5–10%) dari perluasan layanan/penetrasi pasar/efisiensi skala luas. Implementasi cepat (1–3 bulan) dengan mayoritas memanfaatkan infrastruktur existing, investasi terbatas dan ROI relatif cepat.',
      },
      {
        score: 3,
        label: 'Level 3 (Good)',
        desc: 'Dampak menengah (growth 1–5%) pada segmen tertentu dan/atau efisiensi di beberapa proses/unit. Implementasi 3–6 bulan dengan kombinasi penyesuaian/investasi tambahan. Value proposition cukup jelas namun diferensiasi sedang.',
      },
      {
        score: 2,
        label: 'Level 2 (Fair)',
        desc: 'Dampak kecil dan bersifat inkremental pada area sempit. Implementasi >6 bulan dengan investasi yang cukup signifikan. Value proposition kurang jelas atau kurang menarik bagi target segmen.',
      },
      {
        score: 1,
        label: 'Level 1 (Poor)',
        desc: 'Tidak ada dampak yang berarti atau bahkan berisiko menimbulkan dampak negatif bagi bisnis/operasional.',
      },
    ],
  },
  param3: {
    title: 'Kelayakan & Skalabilitas',
    levels: [
      {
        score: 5,
        label: 'Level 5 (Excellent)',
        desc: 'Sangat realistis untuk segera diimplementasikan dengan resource terbatas. Mudah diadopsi dan memiliki model jelas untuk diperluas dengan incremental effort rendah.',
      },
      {
        score: 4,
        label: 'Level 4 (Very Good)',
        desc: 'Realistis untuk diimplementasikan dalam waktu dekat dengan resource terkendali. Ada penyesuaian proses/sistem namun tidak menjadi hambatan signifikan. Potensi scaling jelas meski perlu adaptasi.',
      },
      {
        score: 3,
        label: 'Level 3 (Good)',
        desc: 'Dapat diimplementasikan namun membutuhkan penyesuaian yang cukup pada proses/sistem/kompetensi. Potensi scaling ada, tetapi membutuhkan effort dan investasi lebih besar.',
      },
      {
        score: 2,
        label: 'Level 2 (Fair)',
        desc: 'Terdapat banyak kendala pada aspek teknologi, proses, kompetensi, atau biaya. Potensi scaling rendah dan membutuhkan upaya besar.',
      },
      {
        score: 1,
        label: 'Level 1 (Poor)',
        desc: 'Tidak realistis untuk diimplementasikan dengan resource, waktu, dan kemampuan yang tersedia.',
      },
    ],
  },
  param4: {
    title: 'Professional Judgement',
    levels: [
      {
        score: 5,
        label: 'Level 5 (Excellent)',
        desc: 'Ide langsung menjawab agenda strategis/critical business issue dengan urgensi tinggi dan berpotensi memberikan kontribusi signifikan terhadap sasaran strategis. Konsekuensi besar jika tidak ditangani.',
      },
      {
        score: 4,
        label: 'Level 4 (Very Good)',
        desc: 'Relevan dan mampu memperkuat, melengkapi, atau meningkatkan efektivitas program/proses strategis yang telah berjalan, tetapi bukan kebutuhan mendesak.',
      },
      {
        score: 3,
        label: 'Level 3 (Good)',
        desc: 'Memberikan manfaat namun bukan prioritas utama dan dapat dipertimbangkan setelah kebutuhan yang lebih penting terpenuhi.',
      },
      {
        score: 2,
        label: 'Level 2 (Fair)',
        desc: 'Kurang relevan dengan prioritas strategis atau memberikan kontribusi yang sangat kecil terhadap tujuan perusahaan.',
      },
      {
        score: 1,
        label: 'Level 1 (Poor)',
        desc: 'Tidak sejalan dengan strategi dan tidak layak untuk dipertimbangkan.',
      },
    ],
  },
};

export default function AssessClient({
  competitionId,
  proposalId,
  category,
  existingAssessment,
  prevId,
  nextId,
  currentIndex,
  totalProposals,
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
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => handleSaveNotes(val), 2000);
  };

  const handleNotesBlur = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
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
  }, [scores, competitionId, proposalId]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalScore =
    scores.param1Score + scores.param2Score + scores.param3Score + scores.param4Score;

  let classification = 'Belum Lengkap';
  if (scores.param1Score && scores.param2Score && scores.param3Score && scores.param4Score) {
    // Threshold Grand Final skala 1-5 per dimensi (total 4-20)
    if (totalScore >= 18) classification = 'Diamond';
    else if (totalScore >= 14) classification = 'Platinum';
    else if (totalScore >= 10) classification = 'Gold';
    else if (totalScore >= 6) classification = 'Silver';
    else classification = 'Bronze';
  }

  const renderParam = (key: keyof Assessment, rubricData: (typeof RUBRIC)[keyof typeof RUBRIC]) => (
    <div className="bg-white p-5 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900 mb-4">{rubricData.title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
        {rubricData.levels.map((level) => {
          const isSelected = scores[key] === level.score;
          // Colors: score 5 = blue (Excellent), 4 = emerald, 3 = yellow, 2 = orange, 1 = red (Poor)
          type ColorSet = { active: string; hover: string; dotSelected: string; dotUnselected: string; textSelected: string };
          const colorMap: Record<number, ColorSet> = {
            5: { active: 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-md', hover: 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50', dotSelected: 'bg-blue-600 text-white', dotUnselected: 'bg-blue-100 text-blue-600', textSelected: 'text-blue-900' },
            4: { active: 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 shadow-md', hover: 'border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/50', dotSelected: 'bg-emerald-500 text-white', dotUnselected: 'bg-emerald-100 text-emerald-600', textSelected: 'text-emerald-900' },
            3: { active: 'border-yellow-500 bg-yellow-50 ring-1 ring-yellow-500 shadow-md', hover: 'border-gray-200 hover:border-yellow-400 hover:bg-yellow-50/50', dotSelected: 'bg-yellow-500 text-white', dotUnselected: 'bg-yellow-100 text-yellow-700', textSelected: 'text-yellow-900' },
            2: { active: 'border-orange-500 bg-orange-50 ring-1 ring-orange-500 shadow-md', hover: 'border-gray-200 hover:border-orange-400 hover:bg-orange-50/50', dotSelected: 'bg-orange-500 text-white', dotUnselected: 'bg-orange-100 text-orange-600', textSelected: 'text-orange-900' },
            1: { active: 'border-red-500 bg-red-50 ring-1 ring-red-500 shadow-md', hover: 'border-gray-200 hover:border-red-400 hover:bg-red-50/50', dotSelected: 'bg-red-500 text-white', dotUnselected: 'bg-red-100 text-red-600', textSelected: 'text-red-900' },
          };
          const colors = colorMap[level.score] ?? colorMap[1];

          return (
            <div
              key={level.score}
              onClick={() => setScores((s) => ({ ...s, [key]: level.score }))}
              className={`p-3.5 sm:p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                isSelected ? colors.active : colors.hover
              }`}
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-2.5">
                  <div className={`font-bold text-xs sm:text-sm leading-snug ${isSelected ? colors.textSelected : 'text-gray-800'}`}>
                    {level.label}
                  </div>
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 ${
                      isSelected ? colors.dotSelected : colors.dotUnselected
                    }`}
                  >
                    {level.score}
                  </div>
                </div>
                <p className={`text-xs sm:text-sm leading-relaxed break-words ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                  {level.desc}
                </p>
              </div>
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
              <span
                className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest shadow-sm
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
            <Link
              href={`/sponsor/assess/${prevId}`}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium transition-colors"
            >
              ◀ Sebelumnya
            </Link>
          ) : (
            <button disabled className="px-4 py-2 bg-gray-50 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed">
              ◀ Sebelumnya
            </button>
          )}
          {nextId ? (
            <Link
              href={`/sponsor/assess/${nextId}`}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
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
      {renderParam('param2Score', RUBRIC.param2)}
      {renderParam('param3Score', RUBRIC.param3)}
      {renderParam('param4Score', RUBRIC.param4)}

      {/* Catatan Juri (opsional) */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Catatan Juri <span className="text-xs font-normal text-gray-400">(opsional)</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Catatan kualitatif atau pertimbangan tambahan mengenai proposal ini (tersimpan otomatis &amp; tampil saat Kalibrasi Sidang Penetapan).
            </p>
          </div>
          {notesSaveStatus && (
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full ${
                notesSaveStatus.includes('tersimpan')
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : notesSaveStatus.includes('Gagal')
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
              }`}
            >
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
