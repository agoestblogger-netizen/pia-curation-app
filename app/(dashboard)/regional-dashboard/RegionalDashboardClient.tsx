'use client';

import { useState } from 'react';
import { getProposalById } from '@/app/actions/proposals';
import FormattedTextDisplay from '@/app/components/FormattedTextDisplay';
import ResubmitDocumentSection from '@/app/components/ResubmitDocumentSection';

type Props = {
  sessions: any[];
  finalistsMap: Record<number, any[]>;
  resultsMap: Record<number, any[]>;
};

export default function RegionalDashboardClient({ sessions, finalistsMap, resultsMap }: Props) {
  const [selectedProposalDetail, setSelectedProposalDetail] = useState<any | null>(null);
  const [detailRowNumber, setDetailRowNumber] = useState<number>(0);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const handleShowDetail = async (id: number, rowNum: number) => {
    setIsLoadingDetail(true);
    try {
      const p = await getProposalById(id);
      if (p) {
        setSelectedProposalDetail(p);
        setDetailRowNumber(rowNum);
      }
    } catch (err) {
      console.error('Failed to fetch proposal details:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  return (
    <div className="space-y-6">
      {sessions.map((groupSession) => {
        const isPusat = groupSession.region === 'Kantor Pusat';
        const finalists = finalistsMap[groupSession.id] || [];
        const results = resultsMap[groupSession.id] || [];
        const hasResults = results.length > 0;

        const displayList = hasResults
          ? results.map((r) => ({
              ...r,
              proposal: finalists.find((f) => f.id === r.proposalId)!,
            }))
          : finalists;

        return (
          <div key={groupSession.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header Grup */}
            <div className="bg-indigo-50/50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded text-white flex items-center justify-center text-xs font-bold ${isPusat ? 'bg-[#0F4C81]' : 'bg-[#059669]'}`}>
                  {isPusat ? 'KP' : 'KW'}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{groupSession.region}</h2>
                  <p className="text-xs text-gray-500">{finalists.length} Finalis Terkurasi</p>
                </div>
              </div>
              <div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  groupSession.status === 'hasil_terkunci' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {groupSession.status === 'hasil_terkunci' ? '✅ Hasil Final Terkunci' : '⏳ Sidang Belum Selesai'}
                </span>
              </div>
            </div>

            {/* Tabel */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-16">No</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Inovasi & Inovator</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Unit Kerja / Kota</th>
                    {hasResults && (
                      <>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-24">Skor</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-24">Peringkat</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {displayList.map((item: any, idx: number) => {
                    const proposal = hasResults ? item.proposal : item;
                    if (!proposal) return null;

                    const rank = hasResults ? item.rank : null;
                    const isJuara1 = hasResults && rank === 1;
                    const isJuara2 = hasResults && rank === 2;
                    const isJuara3 = hasResults && rank === 3;

                    let rowBg = 'hover:bg-gray-50';
                    if (isJuara1) rowBg = 'bg-gradient-to-r from-amber-100/90 via-amber-50/40 to-white border-l-4 border-amber-500 shadow-sm';
                    else if (isJuara2) rowBg = 'bg-gradient-to-r from-slate-100 via-slate-50/50 to-white border-l-4 border-slate-400';
                    else if (isJuara3) rowBg = 'bg-gradient-to-r from-orange-100/70 via-amber-50/30 to-white border-l-4 border-amber-600';

                    return (
                      <tr key={proposal.id} className={`${rowBg} transition-colors`}>
                        <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                          {idx + 1}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleShowDetail(proposal.id, idx + 1)}
                            disabled={isLoadingDetail}
                            className="text-sm font-bold text-gray-900 text-left line-clamp-2 hover:text-indigo-600 hover:underline transition-colors focus:outline-none disabled:opacity-75"
                            title="Klik untuk melihat detail proposal"
                          >
                            {proposal.title}
                          </button>
                          <div className="text-xs text-gray-500 mt-1">{proposal.proposerName}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {proposal.proposerOrg}
                        </td>
                        {hasResults && (
                          <>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              <span className={`inline-block px-2.5 py-1 rounded text-sm font-extrabold ${
                                isJuara1 ? 'bg-amber-200/80 text-amber-950 border border-amber-300' :
                                isJuara2 ? 'bg-slate-200 text-slate-900 border border-slate-300' :
                                isJuara3 ? 'bg-orange-200/80 text-orange-950 border border-orange-300' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {Number(item.finalScore).toFixed(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              {isJuara1 && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500 text-white font-extrabold rounded-full text-xs shadow-sm border border-amber-400">
                                  🥇 Juara 1
                                </span>
                              )}
                              {isJuara2 && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-500 text-white font-extrabold rounded-full text-xs shadow-sm border border-slate-400">
                                  🥈 Juara 2
                                </span>
                              )}
                              {isJuara3 && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-700 text-white font-extrabold rounded-full text-xs shadow-sm border border-amber-600">
                                  🥉 Juara 3
                                </span>
                              )}
                              {(!rank || rank > 3) && (
                                <span className="inline-flex items-center px-2.5 py-0.5 bg-gray-100 text-gray-600 font-medium rounded-full text-xs border border-gray-200">
                                  Finalis #{rank || idx + 1}
                                </span>
                              )}
                              {item.tieBreakNote && (
                                <div className="text-[10px] text-amber-900 font-bold mt-1.5 leading-tight border border-amber-300 bg-amber-100/90 rounded px-1.5 py-0.5 block w-fit mx-auto">
                                  ★ Menang Tie-Break
                                </div>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                  {displayList.length === 0 && (
                    <tr>
                      <td colSpan={hasResults ? 5 : 3} className="px-6 py-8 text-center text-gray-500">
                        Belum ada finalis yang ditetapkan untuk grup ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Modal Detail Proposal */}
      {selectedProposalDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-100 flex flex-col text-left">
            {/* Modal Header */}
            <div className="bg-[#0A4736] text-white p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <span className="w-8 h-8 flex items-center justify-center bg-white text-[#0A4736] text-xs font-bold rounded-md shadow-sm">
                  #{detailRowNumber}
                </span>
                <div>
                  <span className="text-xs uppercase font-bold text-green-200 tracking-wider">Detail Proposal Finalis</span>
                  <h3 className="text-lg font-bold truncate max-w-xl">{selectedProposalDetail.title}</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedProposalDetail(null)}
                className="text-green-100 hover:text-white text-xl font-bold p-1 transition-colors"
                title="Tutup Detail"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-bold rounded border border-gray-200">
                    {selectedProposalDetail.category} {selectedProposalDetail.regionCenter ? `· ${selectedProposalDetail.regionCenter}` : '· Pusat'}
                  </span>
                  <span className="text-sm text-gray-500 font-mono ml-auto">ID: {selectedProposalDetail.externalSubId || selectedProposalDetail.externalId}</span>
                </div>

                {/* Ringkasan Submission Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-gray-200 pb-2">
                  <h3 className="font-bold text-gray-900 uppercase tracking-wide text-xs">Ringkasan Submission</h3>
                  {selectedProposalDetail.linkProposal && (
                    <a
                      href={selectedProposalDetail.linkProposal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-semibold text-[#0A4736] hover:underline bg-green-50 px-2 py-1 rounded mt-2 sm:mt-0"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Buka Dokumen Proposal Fase 1
                    </a>
                  )}
                </div>

                <div className="space-y-4 mb-8">
                  {/* Row 1: Innovator */}
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Innovator</div>
                    <div className="text-sm text-gray-900">
                      <span className="font-medium">{selectedProposalDetail.proposerName || '-'}</span>
                      {selectedProposalDetail.proposerEmail && <span className="text-gray-500"> &middot; {selectedProposalDetail.proposerEmail}</span>}
                    </div>
                  </div>

                  {/* Row 2: Tim & Tanggal */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Anggota Tim</div>
                      <div className="text-sm text-gray-900">
                        {Array.isArray(selectedProposalDetail.teamMembers) && selectedProposalDetail.teamMembers.length > 0
                          ? (selectedProposalDetail.teamMembers as string[]).join(', ')
                          : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Tanggal Submit</div>
                      <div className="text-sm text-gray-900">
                        {selectedProposalDetail.submissionDate ? new Date(selectedProposalDetail.submissionDate).toLocaleString('id-ID') : '-'}
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Group, Sub-Tema, & Unit Kerja */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Group</div>
                      <div className="text-sm text-gray-900">{selectedProposalDetail.groupName || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Sub-Tema</div>
                      <div className="text-sm text-gray-900">{selectedProposalDetail.theme || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Nama Unit Kerja</div>
                      <div className="text-sm text-gray-900">{selectedProposalDetail.proposerUnitKerja || '-'}</div>
                    </div>
                  </div>

                  {/* Row 4: Kantor Wilayah (Conditional) */}
                  {selectedProposalDetail.category === 'WILAYAH' && (
                    <div>
                      <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Kantor Wilayah</div>
                      <div className="text-sm text-gray-900">{selectedProposalDetail.regionCenter || '-'}</div>
                    </div>
                  )}
                </div>

                {/* Detail Content (BI or BC/Wilayah/Pusat) */}
                {selectedProposalDetail.category === 'BI' && (
                  <div className="space-y-6 mb-8">
                    <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2 text-md">Detail Breakthrough Innovation (BI)</h3>

                    {selectedProposalDetail.biMasalahDiselesaikan && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Masalah yang Diselesaikan</div>
                        <FormattedTextDisplay
                          proposalId={selectedProposalDetail.id}
                          fieldName="biMasalahDiselesaikan"
                          originalText={selectedProposalDetail.biMasalahDiselesaikan}
                          formattedText={(selectedProposalDetail.formattedTexts as any)?.biMasalahDiselesaikan}
                          canFormat={false}
                          hideFormatButton={true}
                        />
                      </div>
                    )}

                    {selectedProposalDetail.biInovasiDiusulkan && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Inovasi yang Diusulkan</div>
                        <FormattedTextDisplay
                          proposalId={selectedProposalDetail.id}
                          fieldName="biInovasiDiusulkan"
                          originalText={selectedProposalDetail.biInovasiDiusulkan}
                          formattedText={(selectedProposalDetail.formattedTexts as any)?.biInovasiDiusulkan}
                          canFormat={false}
                          hideFormatButton={true}
                        />
                      </div>
                    )}

                    {!selectedProposalDetail.biMasalahDiselesaikan && !selectedProposalDetail.biInovasiDiusulkan && selectedProposalDetail.summary && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Ringkasan Inovasi</div>
                        <FormattedTextDisplay
                          proposalId={selectedProposalDetail.id}
                          fieldName="summary"
                          originalText={selectedProposalDetail.summary}
                          formattedText={(selectedProposalDetail.formattedTexts as any)?.summary}
                          canFormat={false}
                          hideFormatButton={true}
                        />
                      </div>
                    )}
                  </div>
                )}

                {selectedProposalDetail.category !== 'BI' && (
                  <div className="space-y-6 mb-8">
                    <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2 text-md">Detail Business Case (BC/Pusat/Wilayah)</h3>

                    {selectedProposalDetail.bcKelompokDibantu && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Kelompok yang Dibantu</div>
                        <FormattedTextDisplay
                          proposalId={selectedProposalDetail.id}
                          fieldName="bcKelompokDibantu"
                          originalText={selectedProposalDetail.bcKelompokDibantu}
                          formattedText={(selectedProposalDetail.formattedTexts as any)?.bcKelompokDibantu}
                          canFormat={false}
                          hideFormatButton={true}
                        />
                      </div>
                    )}

                    {selectedProposalDetail.bcAlasanMemilihMereka && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Alasan Memilih Mereka</div>
                        <FormattedTextDisplay
                          proposalId={selectedProposalDetail.id}
                          fieldName="bcAlasanMemilihMereka"
                          originalText={selectedProposalDetail.bcAlasanMemilihMereka}
                          formattedText={(selectedProposalDetail.formattedTexts as any)?.bcAlasanMemilihMereka}
                          canFormat={false}
                          hideFormatButton={true}
                        />
                      </div>
                    )}

                    {selectedProposalDetail.summary && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Ringkasan Proposal</div>
                        <FormattedTextDisplay
                          proposalId={selectedProposalDetail.id}
                          fieldName="summary"
                          originalText={selectedProposalDetail.summary}
                          formattedText={(selectedProposalDetail.formattedTexts as any)?.summary}
                          canFormat={false}
                          hideFormatButton={true}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Detail Dokumen Resubmission */}
                <ResubmitDocumentSection
                  proposal={selectedProposalDetail}
                  showSplitScreenButton={false}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-100 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedProposalDetail(null)}
                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg text-sm transition-colors"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
