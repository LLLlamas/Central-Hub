import { Navigate, useLocation } from 'react-router-dom';
import { loadToursIndex } from '@/lib/scratchStorage';

const EXACT_LEGACY_PATHS = [
  '/calendar',
  '/personnel',
  '/plots',
  '/gear',
  '/schedule',
  '/access',
  '/me',
  '/submissions',
  '/daysheet',
  '/ingest/flights',
  '/ingest/riders',
  '/more',
];

const PREFIX_LEGACY_PATHS = ['/calendar/', '/daysheet/', '/print/daysheet/'];

function isKnownLegacyShape(pathname: string): boolean {
  if (EXACT_LEGACY_PATHS.includes(pathname)) return true;
  return PREFIX_LEGACY_PATHS.some((prefix) => pathname.startsWith(prefix));
}

// Pre-migration links (bookmarks, printed sheets, shared URLs) pointed at
// un-scoped leaf paths. If there's exactly one tour on this browser, we know
// which one they meant and can forward them into it; otherwise send them to
// the tour picker at '/'.
export function LegacyPathRedirect() {
  const { pathname, search } = useLocation();

  if (isKnownLegacyShape(pathname)) {
    const tours = loadToursIndex();
    if (tours.length === 1) {
      return <Navigate to={`/t/${tours[0].id}${pathname}${search}`} replace />;
    }
  }

  return <Navigate to="/" replace />;
}
