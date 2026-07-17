import { getSession } from '@/lib/auth/session';
import RegionalTab from './RegionalTab';
import PromoterTab from './PromoterTab';
import GrandFinalTab from './GrandFinalTab';
import RankingTab from './RankingTab';
import Link from 'next/link';

export default async function FinalizationPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const session = await getSession();
  
  if (!session || !session.roles.includes('coordinator')) {
    return <div className="p-8 text-red-500">Unauthorized</div>;
  }

  const currentTab = searchParams.tab || 'regional';

  const tabs = [
    { id: 'regional', label: '1. Regional' },
    { id: 'promoter', label: '2. Promotor' },
    { id: 'grand-final', label: '3. Grand Final' },
    { id: 'ranking', label: '4. Ranking & Hasil Akhir' },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 pt-6 pb-0">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Finalisasi & Ranking</h1>
        
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <Link
                key={tab.id}
                href={`/coordinator/finalization?tab=${tab.id}`}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  isActive
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-auto">
        {currentTab === 'regional' && <RegionalTab />}
        {currentTab === 'promoter' && <PromoterTab />}
        {currentTab === 'grand-final' && <GrandFinalTab />}
        {currentTab === 'ranking' && <RankingTab />}
      </div>
    </div>
  );
}
