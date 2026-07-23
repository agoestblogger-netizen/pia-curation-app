'use client';

import { useState } from 'react';

export default function CollapsibleReview({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <div className="mt-6 pt-6 border-t border-gray-200">
      <div 
        className="flex justify-between items-center cursor-pointer group"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
          Review Proposal (Deskripsi Lengkap)
        </h3>
        <button 
          type="button" 
          className="p-1 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          {isCollapsed ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
          )}
        </button>
      </div>
      
      {!isCollapsed && (
        <div className="mt-4 bg-gray-50 rounded-lg p-4">
          {children}
        </div>
      )}
    </div>
  );
}
