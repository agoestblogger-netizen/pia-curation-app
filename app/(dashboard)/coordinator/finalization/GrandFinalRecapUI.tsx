'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function GrandFinalRecapUI({
  competitionId,
  proposals,
  sponsors,
  assessments,
  readOnly,
}: {
  competitionId: number;
  proposals: any[];
  sponsors: any[];
  assessments: any[];
  readOnly: boolean;
}) {
  // Hitung rata-rata per proposal
  const data = proposals.map(p => {
    const pAssessments = assessments.filter(a => a.proposalId === p.id);
    const count = pAssessments.length;
    
    if (count === 0) return { ...p, param1Avg: 0, param2Avg: 0, param3Avg: 0, param4Avg: 0, totalAvg: 0, finalClass: 'Belum Dinilai' };

    const sum1 = pAssessments.reduce((acc, a) => acc + a.param1Score, 0);
    const sum2 = pAssessments.reduce((acc, a) => acc + a.param2Score, 0);
    const sum3 = pAssessments.reduce((acc, a) => acc + a.param3Score, 0);
    const sum4 = pAssessments.reduce((acc, a) => acc + a.param4Score, 0);
    const totalAvg = (sum1 + sum2 + sum3 + sum4) / count;

    let finalClass = 'Bronze';
    if (totalAvg >= 14) finalClass = 'Diamond';
    else if (totalAvg >= 10) finalClass = 'Platinum';
    else if (totalAvg >= 6) finalClass = 'Gold';

    return {
      ...p,
      param1Avg: (sum1 / count).toFixed(2),
      param2Avg: (sum2 / count).toFixed(2),
      param3Avg: (sum3 / count).toFixed(2),
      param4Avg: (sum4 / count).toFixed(2),
      totalAvg: totalAvg.toFixed(2),
      finalClass,
      assessedCount: count
    };
  });

  // Urutkan berdasarkan total skor rata-rata descending
  data.sort((a, b) => parseFloat(b.totalAvg) - parseFloat(a.totalAvg));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Rekap Penilaian Grand Final</h2>
          <p className="text-sm text-gray-500">Nilai rata-rata dari {sponsors.length} Sponsor (BOD)</p>
        </div>
        {!readOnly && (
          <div className="flex space-x-3">
            <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50">
              Buka Sidang Penetapan
            </button>
            <button className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">
              Kunci Hasil Akhir
            </button>
            <a href="/api/pdf/grand-final" target="_blank" className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 flex items-center">
              Download PDF
            </a>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proposal</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Problem/Solution</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Impact</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Skalabilitas</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Prof. Judgement</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total Skor</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Klasifikasi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, i) => (
              <tr key={row.id}>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900 line-clamp-1" title={row.title}>{row.title}</div>
                  <div className="text-xs text-gray-500 mt-1">Kategori: <span className="font-semibold">{row.category}</span> | Dinilai: {row.assessedCount || 0}/{sponsors.length}</div>
                </td>
                <td className="px-6 py-4 text-center text-sm text-gray-900 font-medium">{row.param1Avg}</td>
                <td className="px-6 py-4 text-center text-sm text-gray-900 font-medium">{row.param2Avg}</td>
                <td className="px-6 py-4 text-center text-sm text-gray-900 font-medium">{row.param3Avg}</td>
                <td className="px-6 py-4 text-center text-sm text-gray-900 font-medium">{row.param4Avg}</td>
                <td className="px-6 py-4 text-center text-sm font-bold text-gray-900">{row.totalAvg}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${row.finalClass === 'Diamond' ? 'bg-blue-100 text-blue-800' :
                      row.finalClass === 'Platinum' ? 'bg-gray-200 text-gray-800' :
                      row.finalClass === 'Gold' ? 'bg-yellow-100 text-yellow-800' :
                      row.finalClass === 'Bronze' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {row.finalClass}
                  </span>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">Belum ada proposal dengan status Grand Final.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
