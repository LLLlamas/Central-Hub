import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { migrateLegacyTourIfNeeded, isAlreadyMigrated } from '@/lib/migrateLegacyTour';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// Runs the one-time legacy-tour migration before anything else in the app
// mounts (in particular before AppStateProvider reads localStorage), so a
// returning single-tour user's data is already on the new per-tour scheme by
// the time the tour is loaded. Reuses the same spinner treatment as Layout's
// `booting` state for a consistent loading feel. The common case (supabase,
// or a `local` user already migrated) skips the spinner via a synchronous
// check instead of always blocking one render behind the async migration call.
export function MigrationGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'done'>(() => (isAlreadyMigrated() ? 'done' : 'checking'));

  useEffect(() => {
    if (state === 'done') return;
    let cancelled = false;
    migrateLegacyTourIfNeeded().finally(() => {
      if (!cancelled) setState('done');
    });
    return () => {
      cancelled = true;
    };
  }, [state]);

  if (state === 'checking') {
    return <LoadingSpinner label="Loading your tour" />;
  }

  return <>{children}</>;
}
