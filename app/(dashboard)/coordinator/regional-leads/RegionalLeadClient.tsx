'use client';

import { useActionState } from 'react';
import { assignRegionalLeadAction } from '@/app/actions/regional-leads';
import { REGIONS, KANWIL_CITIES } from '@/lib/constants';

type Curator = { id: number; name: string };
type RegionalLead = { regionCenter: string; curatorId: number; curatorName: string | null };

export default function RegionalLeadClient({
  curators,
  leads
}: {
  curators: Curator[];
  leads: RegionalLead[];
}) {
  const [state, action, isPending] = useActionState(assignRegionalLeadAction, {});



  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-900">Regional Leads Configuration</h2>
      <p className="text-sm text-gray-500 mb-6">
        Pilih 1 kurator sebagai Regional Lead untuk setiap wilayah. Hanya Regional Lead yang berwenang untuk mengunci (submit) daftar 10 Finalis di Babak Regional.
      </p>

      {state?.error && (
        <div className="p-3 mb-4 rounded-md bg-red-50 text-red-700 text-sm">{state.error}</div>
      )}
      {state?.success && (
        <div className="p-3 mb-4 rounded-md bg-green-50 text-green-700 text-sm">Pengaturan Lead berhasil disimpan.</div>
      )}

      <div className="space-y-6">
        {REGIONS.map((region) => {
          const currentLead = leads.find(l => l.regionCenter === region);
          
          return (
            <div key={region} className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {KANWIL_CITIES.includes(region) ? `Kanwil ${region}` : region}
                </h3>
                <p className="text-sm text-gray-500">
                  Lead Saat Ini: <span className="font-medium text-gray-800">{currentLead?.curatorName ?? 'Belum ada'}</span>
                </p>
              </div>
              <form action={action} className="flex items-center gap-3">
                <input type="hidden" name="regionCenter" value={region} />
                <select 
                  name="curatorId" 
                  defaultValue={currentLead?.curatorId ?? ''}
                  required 
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                >
                  <option value="" disabled>-- Pilih Kurator --</option>
                  {curators.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button 
                  type="submit" 
                  disabled={isPending}
                  className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  Simpan
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
