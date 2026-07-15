// localStorage persistence for AppState's overlay state — the in-memory Maps
// and Sets that sit *on top of* the persisted Tour (visibility edits, lock
// state, section approvals, conflict resolutions, history logs, viewer key).
//
// The Tour itself is persisted by `scratchStorage.ts`; this file is its
// sibling, persisting everything the user accumulates against that tour.
// Maps are stored as entry-arrays, Sets as plain arrays — both JSON-safe.
//
// On reset (`resetScratchTour`) the bundle is cleared so a fresh tour does
// not inherit stale overlays.

import type {
  ID,
  UpdateStamp,
  RiderSectionEdit,
  SectionEditRecord,
  DayLockRecord,
  Visibility,
  PendingVisibilityEdit,
  VisibilityEditRecord,
  ScheduleItemEditRecord,
  FlightPassengerResolution,
  GearItem,
  DocumentSubmission,
  ShowAdvance,
  NegotiationThread,
} from '@/types';
import type {
  ConflictResolution,
  PendingEdit,
  PendingConflictResolution,
} from '@/state/AppState';

const overlayKey = (tourId: ID) => `tour-hub:overlays:${tourId}`;

export interface OverlayBundle {
  lockedDays: ID[];
  resolvedConflicts: [ID, ConflictResolution][];
  dayUpdates: [ID, UpdateStamp][];
  sectionApprovals: [string, UpdateStamp][];
  sectionEdits: [string, RiderSectionEdit][];
  pendingEdits: [string, PendingEdit][];
  pendingConflictResolutions: [ID, PendingConflictResolution][];
  sectionEditHistory: [string, SectionEditRecord[]][];
  dayLockHistory: [ID, DayLockRecord[]][];
  visibilityEdits: [ID, Visibility][];
  pendingVisibilityEdits: [ID, PendingVisibilityEdit][];
  visibilityEditHistory: [ID, VisibilityEditRecord[]][];
  scheduleItemEditHistory: [ID, ScheduleItemEditRecord[]][];
  flightPassengerResolutions: [string, FlightPassengerResolution][];
  /** Per-show venue negotiation — keyed by showDayId. Tour-shared: the venue
   *  persona, the TM, and crew all read the same state (see supabase.ts —
   *  NOT part of the userKey/submissions strip-list). Optional like the other
   *  post-launch additions below (gearItems, submissions, userKey) so legacy
   *  persisted bundles without it still satisfy the type. */
  showAdvances?: [ID, ShowAdvance][];
  /** Per-item negotiation threads, keyed by `threadKey(showDayId, itemKey)`
   *  (see lib/negotiation.ts). Tour-shared, same as `showAdvances`. */
  negotiations?: [string, NegotiationThread][];
  gearItems?: GearItem[];
  /** Rider id the gear list was last seeded/merged from — guards re-seeding on reload. */
  gearSeedRiderId?: string | null;
  /** Single "last updated" stamp for the whole gear list — bumped by every
   *  gear mutator (add/update/delete). One value, not a Map — there's one
   *  gear list per tour. */
  gearUpdatedAt?: UpdateStamp;
  /** Crew document submissions (Milestone 2). On `local` this is the persistence
   *  store for the submission flow so it's testable; on `supabase` submissions
   *  live in the DB and this stays empty (managers/crew read via the backend). */
  submissions?: DocumentSubmission[];
  userKey?: string;
}

// Structural sanity — the bundle is JSON, so a malformed payload (truncated
// write, hand-edited storage, schema drift) shouldn't crash the app on boot.
export function isBundleShaped(v: unknown): v is OverlayBundle {
  if (!v || typeof v !== 'object') return false;
  const b = v as Record<string, unknown>;
  return (
    Array.isArray(b.lockedDays) &&
    Array.isArray(b.resolvedConflicts) &&
    Array.isArray(b.visibilityEdits)
  );
}

export function loadOverlays(tourId: ID): OverlayBundle | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(overlayKey(tourId));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isBundleShaped(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveOverlays(tourId: ID, bundle: OverlayBundle): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(overlayKey(tourId), JSON.stringify(bundle));
  } catch (err) {
    // Quota exceeded or storage unavailable — degrade to in-memory only.
    console.warn('[overlayStorage] could not persist overlays:', err);
  }
}

export function clearOverlays(tourId: ID): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(overlayKey(tourId));
  } catch {
    /* ignore */
  }
}
