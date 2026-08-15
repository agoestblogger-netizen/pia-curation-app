import React from 'react';

const MEDAL_ORDER: Record<string, number> = {
  Diamond: 5, Platinum: 4, Gold: 3, Silver: 2, Bronze: 1,
};

const MEDAL_STYLE: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  Diamond:  { bg: 'bg-blue-50',   text: 'text-blue-800',   border: 'border-blue-200',   icon: '💎' },
  Platinum: { bg: 'bg-slate-100', text: 'text-slate-700',  border: 'border-slate-300',  icon: '🔘' },
  Gold:     { bg: 'bg-amber-50',  text: 'text-amber-800',  border: 'border-amber-200',  icon: '🥇' },
  Silver:   { bg: 'bg-gray-100',  text: 'text-gray-700',   border: 'border-gray-300',   icon: '🥈' },
  Bronze:   { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200', icon: '🥉' },
};

type RegionalGroup = {
  region: string;
  winners: { rank: number | null; title: string; proposerName: string; score: number; tieBreakNote?: string | null }[];
};

type NationalResult = {
  title: string;
  proposerName: string;
  category: string;
  medal: string;
  rank: number | null;
};

export default function HasilJuaraTab({
  regionalGroups,
  nationalResults,
}: {
  regionalGroups: RegionalGroup[];
  nationalResults: NationalResult[];
}) {
  const hasRegional = regionalGroups.length > 0;
  const hasNational = nationalResults.length > 0;

  const biResults = nationalResults
    .filter(r => r.category === 'BI')
    .sort((a, b) => (MEDAL_ORDER[b.medal] || 0) - (MEDAL_ORDER[a.medal] || 0));
  const bcResults = nationalResults
    .filter(r => r.category === 'BC')
    .sort((a, b) => (MEDAL_ORDER[b.medal] || 0) - (MEDAL_ORDER[a.medal] || 0));

  return (
    <div className="space-y-10">

      {/* ── Regional Section ── */}
      {hasRegional && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">🏆</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Hasil Final Regional</h2>
              <p className="text-sm text-gray-500 mt-0.5">Juara per Kanwil &amp; Kantor Pusat</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {regionalGroups.map(group => {
              const juara1 = group.winners.find(w => w.rank === 1);
              const juara2 = group.winners.find(w => w.rank === 2);
              const juara3 = group.winners.find(w => w.rank === 3);
              const others = group.winners.filter(w => !w.rank || w.rank > 3);

              return (
                <div
                  key={group.region}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col"
                >
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-3">
                    <h3 className="font-bold text-white text-base">{group.region}</h3>
                  </div>

                  <div className="divide-y divide-gray-100 flex-1">
                    {/* Juara 1 */}
                    {juara1 && (
                      <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-white border-l-4 border-amber-400">
                        <div className="flex items-start gap-2">
                          <span className="text-xl mt-0.5 flex-shrink-0">🥇</span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-0.5">Juara 1</div>
                            <div className="font-semibold text-gray-900 text-sm leading-snug">{juara1.title}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{juara1.proposerName}</div>
                            <div className="text-xs text-amber-600 font-bold mt-1">
                              Skor: {juara1.score.toFixed(2)}
                              {juara1.tieBreakNote && <span className="ml-1 text-[10px] bg-amber-100 px-1 py-0.5 rounded">★ TB</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Juara 2 */}
                    {juara2 && (
                      <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-l-4 border-slate-300">
                        <div className="flex items-start gap-2">
                          <span className="text-xl mt-0.5 flex-shrink-0">🥈</span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-0.5">Juara 2</div>
                            <div className="font-semibold text-gray-900 text-sm leading-snug">{juara2.title}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{juara2.proposerName}</div>
                            <div className="text-xs text-slate-500 font-bold mt-1">Skor: {juara2.score.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Juara 3 */}
                    {juara3 && (
                      <div className="px-5 py-4 bg-gradient-to-r from-orange-50 to-white border-l-4 border-orange-300">
                        <div className="flex items-start gap-2">
                          <span className="text-xl mt-0.5 flex-shrink-0">🥉</span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-0.5">Juara 3</div>
                            <div className="font-semibold text-gray-900 text-sm leading-snug">{juara3.title}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{juara3.proposerName}</div>
                            <div className="text-xs text-orange-600 font-bold mt-1">Skor: {juara3.score.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Other finalists */}
                    {others.map((w, idx) => (
                      <div key={idx} className="px-5 py-3">
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-gray-400 font-bold mt-0.5 w-5 flex-shrink-0">#{w.rank ?? '—'}</span>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-800 text-sm leading-snug">{w.title}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{w.proposerName}</div>
                          </div>
                          <div className="ml-auto text-xs text-gray-400 font-medium flex-shrink-0">{w.score.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}

                    {!juara1 && !juara2 && !juara3 && others.length === 0 && (
                      <div className="px-5 py-4 text-sm text-gray-400 italic">Belum ada data juara.</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Nasional Section ── */}
      {hasNational && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">🎯</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Hasil Grand Final Nasional</h2>
              <p className="text-sm text-gray-500 mt-0.5">Medali Sidang Penetapan — BI &amp; BC</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[{ key: 'BI', label: 'Breakthrough Innovation', data: biResults },
              { key: 'BC', label: 'Business Case', data: bcResults }].map(cat => (
              <div key={cat.key} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-5 py-3">
                  <h3 className="font-bold text-white text-base">{cat.label}</h3>
                </div>
                {cat.data.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-gray-400 italic text-center">Belum ada hasil.</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {cat.data.map((r, idx) => {
                      const style = MEDAL_STYLE[r.medal] || MEDAL_STYLE['Bronze'];
                      return (
                        <div key={idx} className="px-5 py-3.5 flex items-start gap-3">
                          <span className={`flex-shrink-0 mt-0.5 px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1 ${style.bg} ${style.text} ${style.border}`}>
                            <span>{style.icon}</span>
                            <span>{r.medal}</span>
                          </span>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 text-sm leading-snug">{r.title}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{r.proposerName}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!hasRegional && !hasNational && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center text-amber-800">
          Belum ada hasil final yang dikunci.
        </div>
      )}
    </div>
  );
}
