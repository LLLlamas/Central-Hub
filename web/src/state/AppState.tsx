import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { mockTour, currentUsers, defaultUserKey } from '@/data/mockTour';
import { MOCK_NOW } from '@/lib/today';
import type {
  Tour,
  CurrentUser,
  Day,
  ID,
  UpdateStamp,
  InputChannel,
  MonitorMix,
  FOHOutput,
} from '@/types';

export type DensityMode = 'simple' | 'pro';

export interface ConflictResolution {
  resolvedAt: string;       // ISO datetime
  resolvedBy: string;       // user name
  chosenValue: string;      // free-text — picked from a value or typed in
  source?: string;          // optional label, e.g. "Confirmed with PM via email"
  note?: string;
}

/** Inline corrections to an extracted rider section, keyed by `${type}-${index}`. */
export interface RiderSectionEdit {
  inputList?: InputChannel[];
  monitorMix?: MonitorMix[];
  fohOutputs?: FOHOutput[];
  freeText?: string;
  freeTextEn?: string;
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
  // Rider section review — keyed by `${sectionType}-${index}`. Approvals seed
  // from sections whose mock status is already 'approved'. Edits are inline
  // corrections layered over the extracted payload.
  isSectionApproved: (key: string) => boolean;
  getSectionApproval: (key: string) => UpdateStamp | undefined;
  approveSection: (key: string) => void;
  reopenSection: (key: string) => void;
  getSectionEdit: (key: string) => RiderSectionEdit | undefined;
  updateSectionEdit: (key: string, patch: RiderSectionEdit) => void;
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

// Seed: rider sections whose mock status is already 'approved' start approved,
// stamped to when the PM reviewed revision 2 of the rider.
const SEED_SECTION_APPROVAL: UpdateStamp = { at: '2025-09-11T10:00', by: 'Manuel González' };
function initialSectionApprovals(): Map<string, UpdateStamp> {
  const seed = new Map<string, UpdateStamp>();
  mockTour.riderImports.forEach((imp) => {
    imp.sections.forEach((s, i) => {
      if (s.status === 'approved') seed.set(`${s.type}-${i}`, SEED_SECTION_APPROVAL);
    });
  });
  return seed;
}

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
  const [sectionApprovals, setSectionApprovals] = useState<ReadonlyMap<string, UpdateStamp>>(
    initialSectionApprovals,
  );
  const [sectionEdits, setSectionEdits] = useState<ReadonlyMap<string, RiderSectionEdit>>(
    () => new Map(),
  );

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

  const isSectionApproved = useCallback(
    (key: string) => sectionApprovals.has(key),
    [sectionApprovals],
  );
  const getSectionApproval = useCallback(
    (key: string) => sectionApprovals.get(key),
    [sectionApprovals],
  );
  const approveSection = useCallback(
    (key: string) => {
      setSectionApprovals((prev) => {
        const next = new Map(prev);
        next.set(key, { at: MOCK_NOW, by: currentName });
        return next;
      });
    },
    [currentName],
  );
  const reopenSection = useCallback((key: string) => {
    setSectionApprovals((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);
  const getSectionEdit = useCallback(
    (key: string) => sectionEdits.get(key),
    [sectionEdits],
  );
  const updateSectionEdit = useCallback((key: string, patch: RiderSectionEdit) => {
    setSectionEdits((prev) => {
      const next = new Map(prev);
      next.set(key, { ...next.get(key), ...patch });
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
      isSectionApproved,
      getSectionApproval,
      approveSection,
      reopenSection,
      getSectionEdit,
      updateSectionEdit,
    }),
    [userKey, densityMode, lockedDays, isDayLocked, toggleDayLocked, setDayLocked, getDayLastUpdated, resolvedConflicts, resolveConflict, unresolveConflict, isSectionApproved, getSectionApproval, approveSection, reopenSection, getSectionEdit, updateSectionEdit],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}
