import React from 'react';

export default function LoadingOverlay() {
  return (
    <div className="flex-1 w-full min-h-[60vh] flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="flex flex-col items-center p-8">
        <svg 
          className="animate-spin h-14 w-14 text-indigo-600 mb-5" 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          ></circle>
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p className="text-gray-800 font-bold text-lg animate-pulse tracking-wide">Sedang proses.....</p>
        <p className="text-gray-400 text-sm mt-2">Memuat data terbaru</p>
      </div>
    </div>
  );
}
