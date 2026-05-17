import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { mockTour, currentUsers, defaultUserKey } from '@/data/mockTour';
import { MOCK_NOW } from '@/lib/today';
import type { Tour, CurrentUser, Day, ID, UpdateStamp } from '@/types';

export type DensityMode = 'simple' | 'pro';

export interface ConflictResolution {
  resolvedAt: string;       // ISO datetime
  resolvedBy: string;       // user name
  chosenValue: string;      // free-text — picked from a value or typed in
  source?: string;          // optional label, e.g. "Confirmed with PM via email"
  note?: string;
}

interface AppState {
  tour: Tour;
  user: CurrentUser;
  userKey: keyof typeof currentUsers;
  setUserKey: (k: keyof typeof currentUsers) => void;
  allUsers: typeof currentUsers;
  densityMode: DensityMode;
  setDensityMode: (mode: DensityMode) => void;
  // Per-day "locked / closed out" state. Kept here so toggling
  // a day doesn't have to mutate the mock data file.
  lockedDays: ReadonlySet<ID>;
  isDayLocked: (dayId: ID) => boolean;
  toggleDayLocked: (dayId: ID) => void;
  setDayLocked: (dayId: ID, locked: boolean) => void;
  // Day-level "last updated" stamp. Seeded history lives on each Day;
  // in-app actions (locking a day) layer a fresh stamp keyed by day id.
  getDayLastUpdated: (day: Day) => UpdateStamp | undefined;
  // Conflict resolutions, keyed by conflict id.
  resolvedConflicts: ReadonlyMap<ID, ConflictResolution>;
  resolveConflict: (id: ID, resolution: Omit<ConflictResolution, 'resolvedAt' | 'resolvedBy'>) => void;
  unresolveConflict: (id: ID) => void;
}

const Ctx = createContext<AppState | null>(null);
const DENSITY_STORAGE_KEY = 'tour-hub:density-mode';

function getInitialDensityMode(): DensityMode {
  if (typeof window === 'undefined') return 'pro';
  return window.localStorage.getItem(DENSITY_STORAGE_KEY) === 'simple' ? 'simple' : 'pro';
}

// Seed: pre-lock the early rehearsal/travel days to show the chip
// in the UI from first paint. (Once the user wires real auth + a
// backend these would come from the DB.)
const INITIAL_LOCKED: ID[] = [
  'day_2025-09-22',
  'day_2025-09-23',
  'day_2025-09-24',
  'day_2025-09-25',
];

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [userKey, setUserKey] = useState<keyof typeof currentUsers>(defaultUserKey);
  const [densityMode, setDensityMode] = useState<DensityMode>(getInitialDensityMode);
  const [lockedDays, setLockedDays] = useState<ReadonlySet<ID>>(
    () => new Set(INITIAL_LOCKED),
  );
  const [resolvedConflicts, setResolvedConflicts] = useState<ReadonlyMap<ID, ConflictResolution>>(
    () => new Map(),
  );
  const [dayUpdates, setDayUpdates] = useState<ReadonlyMap<ID, UpdateStamp>>(() => new Map());

  useEffect(() => {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, densityMode);
  }, [densityMode]);

  const currentName = currentUsers[userKey].name;

  // Day-level "last updated" overlay. Seeded history lives on each Day;
  // in-app actions stamp a fresh entry here, keyed by day id, against the
  // pinned demo clock + current viewer.
  const stampDay = useCallback(
    (dayId: ID) => {
      setDayUpdates((prev) => {
        const next = new Map(prev);
        next.set(dayId, { at: MOCK_NOW, by: currentName });
        return next;
      });
    },
    [currentName],
  );
  const getDayLastUpdated = useCallback(
    (day: Day): UpdateStamp | undefined => dayUpdates.get(day.id) ?? day.lastUpdated,
    [dayUpdates],
  );

  const isDayLocked = useCallback((dayId: ID) => lockedDays.has(dayId), [lockedDays]);
  const toggleDayLocked = useCallback(
    (dayId: ID) => {
      setLockedDays((prev) => {
        const next = new Set(prev);
        if (next.has(dayId)) next.delete(dayId);
        else next.add(dayId);
        return next;
      });
      stampDay(dayId);
    },
    [stampDay],
  );
  const setDayLocked = useCallback(
    (dayId: ID, locked: boolean) => {
      setLockedDays((prev) => {
        const has = prev.has(dayId);
        if (has === locked) return prev;
        const next = new Set(prev);
        if (locked) next.add(dayId);
        else next.delete(dayId);
        return next;
      });
      stampDay(dayId);
    },
    [stampDay],
  );

  const resolveConflict = useCallback(
    (id: ID, resolution: Omit<ConflictResolution, 'resolvedAt' | 'resolvedBy'>) => {
      setResolvedConflicts((prev) => {
        const next = new Map(prev);
        next.set(id, {
          ...resolution,
          resolvedAt: MOCK_NOW,
          resolvedBy: currentName,
        });
        return next;
      });
    },
    [currentName],
  );
  const unresolveConflict = useCallback((id: ID) => {
    setResolvedConflicts((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo<AppState>(
    () => ({
      tour: mockTour,
      user: currentUsers[userKey],
      userKey,
      setUserKey,
      allUsers: currentUsers,
      densityMode,
      setDensityMode,
      lockedDays,
      isDayLocked,
      toggleDayLocked,
      setDayLocked,
      getDayLastUpdated,
      resolvedConflicts,
      resolveConflict,
      unresolveConflict,
    }),
    [userKey, densityMode, lockedDays, isDayLocked, toggleDayLocked, setDayLocked, getDayLastUpdated, resolvedConflicts, resolveConflict, unresolveConflict],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}
