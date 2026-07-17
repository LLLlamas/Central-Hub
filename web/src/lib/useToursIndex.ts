// Hook for the "My Tours" home page: reads the tours-index from
// localStorage on mount, and re-reads it on tab focus/visibilitychange so a
// My Tours tab left open picks up tours created/edited in another tab. Plain
// hook — no context/provider, any component can call it directly.

import { useEffect, useState } from 'react';
import type { TourSummary } from '@/types';
import { loadToursIndex } from '@/lib/scratchStorage';

export function useToursIndex(): TourSummary[] {
  const [tours, setTours] = useState<TourSummary[]>([]);

  useEffect(() => {
    const refresh = () => setTours(loadToursIndex());
    refresh();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return tours;
}
