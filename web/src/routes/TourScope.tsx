import { Navigate, Outlet, Link, useParams } from 'react-router-dom';
import { AppStateProvider } from '@/state/AppState';
import { BACKEND_KIND } from '@/lib/backend';
import { loadScratchTour } from '@/lib/scratchStorage';

export function TourScope() {
  const { tourId } = useParams<{ tourId: string }>();
  if (!tourId) return <Navigate to="/" replace />;
  // On `local`, AppStateProvider's initializer falls back to
  // `createScratchTour(tourId)` for any id with nothing stored — silently
  // fabricating (and then persisting) a brand-new blank tour for a stale
  // bookmark or typo'd id instead of telling the user it's gone. Catch that
  // here, before the provider ever mounts. Supabase's shared tour is resolved
  // from the caller's membership rather than a bookmarkable id, so this
  // synchronous local-storage check doesn't apply there.
  if (BACKEND_KIND !== 'supabase' && !loadScratchTour(tourId)) {
    return <TourNotFound />;
  }
  return (
    <AppStateProvider key={tourId} tourId={tourId}>
      <Outlet />
    </AppStateProvider>
  );
}

function TourNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper)] px-6">
      <div className="text-center max-w-sm">
        <h1 className="font-display text-[22px] font-bold text-[var(--color-ink)]">Tour not found</h1>
        <p className="mt-2 text-[13px] text-[var(--color-ink-3)]">
          This tour isn't in this browser — the link may be old, or the show may have been removed.
        </p>
        <Link to="/" className="mt-4 inline-block text-[13px] font-semibold underline">
          ← Back to My Shows
        </Link>
      </div>
    </div>
  );
}
