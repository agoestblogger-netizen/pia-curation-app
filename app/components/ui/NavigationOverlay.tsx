'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function NavigationOverlay() {
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Reset loading state when the route actually changes
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Find the closest anchor tag
      const target = (e.target as Element).closest('a');
      
      if (target && target.href) {
        // Only trigger for internal links that aren't opening in a new tab
        if (target.target === '_blank') return;
        
        try {
          const url = new URL(target.href);
          const currentUrl = new URL(window.location.href);
          
          // If it's an internal link and the path/search actually changes
          if (
            url.origin === currentUrl.origin && 
            (url.pathname !== currentUrl.pathname || url.search !== currentUrl.search)
          ) {
            setIsNavigating(true);
          }
        } catch (err) {
          // ignore invalid URLs
        }
      }
    };
    
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  if (!isNavigating) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/20 backdrop-blur-[2px]">
      <div className="flex flex-col items-center p-8 bg-white/90 rounded-2xl shadow-2xl">
        <svg 
          className="animate-spin h-14 w-14 text-indigo-600 mb-5" 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-gray-800 font-bold text-lg animate-pulse tracking-wide">Sedang proses.....</p>
      </div>
    </div>
  );
}
