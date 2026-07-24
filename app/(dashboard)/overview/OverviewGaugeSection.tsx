'use client';

interface VerdictCounts {
  lolos: number;
  duplication: number;
  mapped: number;
  non_compliance: number;
  low_impact: number;
}

interface OverviewGaugeSectionProps {
  totalResubmit: number;
  totalCurated: number;
  verdicts: VerdictCounts;
  showVerdictsBreakdown?: boolean;
}

export default function OverviewGaugeSection({
  totalResubmit,
  totalCurated,
  verdicts,
  showVerdictsBreakdown = true,
}: OverviewGaugeSectionProps) {
  const percentage = totalResubmit > 0 ? (totalCurated / totalResubmit) * 100 : 0;
  const percentageFormatted = percentage.toFixed(1);
  const remaining = Math.max(0, totalResubmit - totalCurated);

  // SVG Gauge Meter Parameters (Semi-circle Arc)
  const strokeWidth = 14;
  const radius = 65;
  const circumference = Math.PI * radius;
  const fillDash = (Math.min(100, percentage) / 100) * circumference;

  const VERDICT_CONFIG = [
    {
      key: 'lolos',
      label: 'Lolos',
      count: verdicts.lolos,
      color: 'bg-emerald-500',
      text: 'text-emerald-700',
      bg: 'bg-emerald-50/70',
      border: 'border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-800',
      desc: 'Direkomendasikan ke FGD / Tahap Lanjutan',
    },
    {
      key: 'duplication',
      label: 'Duplication',
      count: verdicts.duplication,
      color: 'bg-rose-500',
      text: 'text-rose-700',
      bg: 'bg-rose-50/70',
      border: 'border-rose-200',
      badge: 'bg-rose-100 text-rose-800',
      desc: 'Terindikasi duplikasi dengan proposal lain',
    },
    {
      key: 'mapped',
      label: 'Mapped',
      count: verdicts.mapped,
      color: 'bg-blue-500',
      text: 'text-blue-700',
      bg: 'bg-blue-50/70',
      border: 'border-blue-200',
      badge: 'bg-blue-100 text-blue-800',
      desc: 'Di-remap/disesuaikan pengelompokannya',
    },
    {
      key: 'non_compliance',
      label: 'Non-Compliance',
      count: verdicts.non_compliance,
      color: 'bg-amber-500',
      text: 'text-amber-700',
      bg: 'bg-amber-50/70',
      border: 'border-amber-200',
      badge: 'bg-amber-100 text-amber-800',
      desc: 'Tidak memenuhi ketentuan administrasi / format',
    },
    {
      key: 'low_impact',
      label: 'Low Impact',
      count: verdicts.low_impact,
      color: 'bg-purple-500',
      text: 'text-purple-700',
      bg: 'bg-purple-50/70',
      border: 'border-purple-200',
      badge: 'bg-purple-100 text-purple-800',
      desc: 'Dampak & urgensi solusi tergolong rendah',
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
      {/* Gauge Meter Card (Selalu Tampil Untuk Semua Role) */}
      <div className={`${showVerdictsBreakdown ? 'lg:col-span-5' : 'lg:col-span-12'} bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between`}>
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-gray-900">Progress Kurasi Keseluruhan</h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Basis: {totalResubmit.toLocaleString('id-ID')} Aktif
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Persentase proposal aktif yang telah selesai discreening oleh kurator
          </p>
        </div>

        {/* Gauge SVG */}
        <div className="flex flex-col items-center justify-center my-2 relative">
          <svg className="w-60 h-32 overflow-visible" viewBox="0 0 160 95">
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="50%" stopColor="#6366F1" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>

            {/* Track Background Arc */}
            <path
              d="M 15 85 A 65 65 0 0 1 145 85"
              fill="none"
              stroke="#F3F4F6"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />

            {/* Progress Arc */}
            <path
              d="M 15 85 A 65 65 0 0 1 145 85"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${fillDash} ${circumference}`}
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          {/* Inner Center Label */}
          <div className="absolute bottom-2 flex flex-col items-center justify-center text-center">
            <div className="text-4xl font-extrabold text-gray-900 tracking-tight">
              {percentageFormatted}%
            </div>
            <div className="text-xs font-semibold text-indigo-600 mt-0.5">
              {totalCurated.toLocaleString('id-ID')} dari {totalResubmit.toLocaleString('id-ID')} dikurasi
            </div>
          </div>
        </div>

        {/* Sub-footer stats */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Sudah Dikurasi: <strong className="text-indigo-600 font-bold">{totalCurated.toLocaleString('id-ID')}</strong></span>
          <span>Belum Dikurasi: <strong className="text-amber-600 font-bold">{remaining.toLocaleString('id-ID')}</strong></span>
        </div>
      </div>

      {/* 5 Parameter Verdict Breakdown (Khusus Koordinator & Admin) */}
      {showVerdictsBreakdown && (
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-gray-900">Breakdown 5 Parameter Status Screening</h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                Hasil Screening ({totalCurated})
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Rincian proposal berdasarkan 5 verdict hasil kurasi (dari {totalResubmit.toLocaleString('id-ID')} proposal aktif)
            </p>
          </div>

          <div className="space-y-2.5 my-auto">
            {VERDICT_CONFIG.map((v) => {
              const pctOfCurated = totalCurated > 0 ? ((v.count / totalCurated) * 100).toFixed(1) : '0.0';
              const pctOfTotal = totalResubmit > 0 ? ((v.count / totalResubmit) * 100).toFixed(1) : '0.0';

              return (
                <div key={v.key} className={`p-3 rounded-xl border ${v.border} ${v.bg} flex items-center justify-between transition-colors`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
                    <div className={`w-3 h-3 rounded-full ${v.color} flex-shrink-0`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${v.text}`}>{v.label}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.2 rounded-full ${v.badge}`}>
                          {v.count} proposal
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 truncate hidden sm:block">
                        {v.desc}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className={`font-bold text-sm ${v.text}`}>
                      {v.count}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {pctOfCurated}% terkurasi ({pctOfTotal}% total)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
