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
} from '@/types';
import type {
  ConflictResolution,
  PendingEdit,
  PendingConflictResolution,
} from '@/state/AppState';

const OVERLAY_KEY = 'tour-hub:scratch-overlays';

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
  userKey?: string;
}

// Structural sanity — the bundle is JSON, so a malformed payload (truncated
// write, hand-edited storage, schema drift) shouldn't crash the app on boot.
function isBundleShaped(v: unknown): v is OverlayBundle {
  if (!v || typeof v !== 'object') return false;
  const b = v as Record<string, unknown>;
  return (
    Array.isArray(b.lockedDays) &&
    Array.isArray(b.resolvedConflicts) &&
    Array.isArray(b.visibilityEdits)
  );
}

export function loadOverlays(): OverlayBundle | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(OVERLAY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isBundleShaped(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveOverlays(bundle: OverlayBundle): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OVERLAY_KEY, JSON.stringify(bundle));
  } catch (err) {
    // Quota exceeded or storage unavailable — degrade to in-memory only.
    console.warn('[overlayStorage] could not persist overlays:', err);
  }
}

export function clearOverlays(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(OVERLAY_KEY);
  } catch {
    /* ignore */
  }
}
