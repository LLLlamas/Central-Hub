import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createScratchTour, scratchUsers, scratchDefaultUserKey } from '@/data/scratchTour';
import { loadScratchTour, saveScratchTour } from '@/lib/scratchStorage';
import { loadOverlays, saveOverlays, clearOverlays } from '@/lib/overlayStorage';
import * as tourQueries from '@/lib/tourQueries';
import type { ParsedRoute } from '@/lib/routeCsv';
import { vis } from '@/lib/visibility';
import { MOCK_NOW } from '@/lib/today';
import type {
  Tour,
  CurrentUser,
  Day,
  ID,
  UpdateStamp,
  RiderSectionEdit,
  FieldChange,
  SectionEditRecord,
  DayLockRecord,
  Visibility,
  PendingVisibilityEdit,
  VisibilityEditRecord,
  ScheduleItem,
  Travel,
  Hotel,
  Task,
  Group,
  GroupTag,
  TourPerson,
  RiderImport,
  FlightImport,
  FlightPassengerResolution,
  ScheduleItemType,
  Conflict,
} from '@/types';
import { defaultVisibilityForType } from '@/lib/visibilityDefaults';

export type DensityMode = 'simple' | 'pro';
export type { ParsedRoute } from '@/lib/routeCsv';

export interface ConflictResolution {
  resolvedAt: string;       // ISO datetime
  resolvedBy: string;       // user name
  chosenValue: string;      // free-text — picked from a value or typed in
  source?: string;          // optional label, e.g. "Confirmed with PM via email"
  note?: string;
  proposedAt?: UpdateStamp; // set when a non-manager proposed it; approved by resolvedBy
}

// Re-export so consumers can import from one place.
export type { RiderSectionEdit, PendingVisibilityEdit, VisibilityEditRecord } from '@/types';

/** A correction proposed by a non-manager, awaiting manager approval. */
export interface PendingEdit {
  key: string;
  patch: RiderSectionEdit;
  before: RiderSectionEdit;   // state before the proposal — used to compute diff
  proposedAt: UpdateStamp;
}

/** A conflict resolution proposed by a non-manager, awaiting manager approval. */
export interface PendingConflictResolution {
  conflictId: ID;
  chosenValue: string;
  source?: string;
  note?: string;
  proposedAt: UpdateStamp;
}

interface AppState {
  tour: Tour;
  user: CurrentUser;
  userKey: string;
  setUserKey: (k: string) => void;
  allUsers: Record<string, CurrentUser>;
  densityMode: DensityMode;
  setDensityMode: (mode: DensityMode) => void;

  // The tour starts as an empty shell the user builds up by uploading fixture
  // files. Reset wipes it back to the shell. See CLAUDE.md "Data modes".
  resetScratchTour: () => void;
  applyRouteToScratch: (parsed: ParsedRoute) => void;
  addRiderImportToScratch: (ri: RiderImport, personnel: TourPerson[]) => void;
  addFlightImportToScratch: (fi: FlightImport) => void;
  commitFlightImportToScratch: (importId: ID) => void;
  addHotelImportToScratch: (hotels: Hotel[], tasks: Task[]) => void;

  // Cancel / re-import — each step on /ingest/flights and /ingest/riders has
  // a "Remove" affordance that wipes the data the import laid down. Reason is
  // optional; the audit log keeps who/when on the resulting empty state.
  cancelRouteImport: (reason?: string) => void;
  cancelRiderImport: (id: ID, reason?: string) => void;
  discardFlightImport: (id: ID, reason?: string) => void;
  cancelHotelImport: (reason?: string) => void;

  /** Duplicate handling — `existing` is the older import that already claimed
   *  the leg; `incoming` is the new upload sitting in review.
   *  - replace: discards `existing`, keeps `incoming` as the canonical record.
   *  - merge:   applies `incoming`'s passengers onto `existing` (updates seats
   *             for matched names, adds new names), then discards `incoming`. */
  replaceFlightImport: (existingId: ID, incomingId: ID) => void;
  mergeFlightImport: (existingId: ID, incomingId: ID) => void;

  // Per-passenger resolution for unmatched flight rows. Keyed by
  // `${importId}::${name.toLowerCase()}`. Applied at commit-time.
  flightPassengerResolutions: ReadonlyMap<string, FlightPassengerResolution>;
  setFlightPassengerResolution: (importId: ID, name: string, res: FlightPassengerResolution | null) => void;
  getFlightPassengerResolution: (importId: ID, name: string) => FlightPassengerResolution | undefined;

  // Tour-level visibility template by schedule-item type. New schedule items
  // inherit the blob for their type; per-item edits override it.
  getScheduleTypeDefault: (type: ScheduleItemType) => Visibility;
  setScheduleTypeDefault: (type: ScheduleItemType, v: Visibility) => void;
  /** Push the type's current template to every existing schedule item of that
   *  type — used by the "Sync to all N existing items" action in the type
   *  defaults editor. Returns the count of items synced. Records per-item
   *  history entries so the audit trail shows the bulk sync. */
  applyTypeTemplateToAllItems: (type: ScheduleItemType) => number;
  /** Save a visibility blob and cascade it to every schedule item of the same
   *  type — the schedule-grouping save. Updates each matching item's entry in
   *  `visibilityEdits` AND bumps the tour-level template so future items of
   *  this type inherit the same. Records a history entry per affected item.
   *  Returns the count of items affected. */
  saveVisibilityForType: (type: ScheduleItemType, patch: Visibility) => number;

  // Tour query helpers, bound to the active tour.
  getDay: (date: string) => Day | undefined;
  getDayById: (id: ID) => Day | undefined;
  getScheduleItemsForDay: (dayId: ID) => ScheduleItem[];
  getTravelForDay: (dayId: ID) => Travel[];
  getHotelsForDay: (dayId: ID) => Hotel[];
  getTasksForDay: (dayId: ID) => Task[];
  getTourPersonById: (id: ID) => TourPerson | undefined;
  getGroupById: (id: ID) => Group | undefined;
  getGroupTagById: (id: ID) => GroupTag | undefined;
  getAllConflicts: () => Conflict[];
  // Per-day "locked / closed out" state. Kept here so toggling
  // a day doesn't have to mutate the mock data file.
  lockedDays: ReadonlySet<ID>;
  isDayLocked: (dayId: ID) => boolean;
  toggleDayLocked: (dayId: ID, reason?: string) => void;
  setDayLocked: (dayId: ID, locked: boolean, reason?: string) => void;
  // Per-day lock/unlock history — each toggle pushes a DayLockRecord.
  dayLockHistory: ReadonlyMap<ID, DayLockRecord[]>;
  getDayLockHistory: (dayId: ID) => DayLockRecord[];
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
  updateSectionEdit: (key: string, patch: RiderSectionEdit, before?: RiderSectionEdit) => void;
  // Non-manager proposed corrections pending manager approval.
  // keyed by `${sectionType}-${index}`, same as sectionEdits.
  getPendingEdit: (key: string) => PendingEdit | undefined;
  proposeSectionEdit: (key: string, patch: RiderSectionEdit, before: RiderSectionEdit) => void;
  approvePendingEdit: (key: string) => void;
  rejectPendingEdit: (key: string) => void;
  getSectionHistory: (key: string) => SectionEditRecord[];

  pendingConflictResolutions: ReadonlyMap<ID, PendingConflictResolution>;
  getPendingConflictResolution: (id: ID) => PendingConflictResolution | undefined;
  proposeConflictResolution: (id: ID, resolution: Omit<PendingConflictResolution, 'conflictId' | 'proposedAt'>) => void;
  approvePendingConflictResolution: (id: ID) => void;
  rejectPendingConflictResolution: (id: ID) => void;

  // Schedule-item visibility edits — keyed by schedule item id. Same pending /
  // approval / history pattern as rider section edits. updateVisibilityEdit
  // replaces the whole Visibility blob (not a merge).
  visibilityEdits: ReadonlyMap<ID, Visibility>;
  getVisibilityEdit: (itemId: ID) => Visibility | undefined;
  updateVisibilityEdit: (itemId: ID, patch: Visibility, before: Visibility) => void;
  pendingVisibilityEdits: ReadonlyMap<ID, PendingVisibilityEdit>;
  getPendingVisibilityEdit: (itemId: ID) => PendingVisibilityEdit | undefined;
  proposeVisibilityEdit: (itemId: ID, patch: Visibility, before: Visibility) => void;
  approvePendingVisibilityEdit: (itemId: ID) => void;
  rejectPendingVisibilityEdit: (itemId: ID) => void;
  getVisibilityHistory: (itemId: ID) => VisibilityEditRecord[];
}

const Ctx = createContext<AppState | null>(null);
const DENSITY_STORAGE_KEY = 'tour-hub:density-mode';

function getInitialDensityMode(): DensityMode {
  if (typeof window === 'undefined') return 'pro';
  return window.localStorage.getItem(DENSITY_STORAGE_KEY) === 'simple' ? 'simple' : 'pro';
}

// Stamp used when the rider import seeds approvals for sections the rider
// marks already-approved — dated to when the PM reviewed revision 2.
const SEED_SECTION_APPROVAL: UpdateStamp = { at: '2025-09-11T10:00', by: 'Manuel González' };

function computeSectionChanges(before: RiderSectionEdit, after: RiderSectionEdit): FieldChange[] {
  const changes: FieldChange[] = [];

  const beforeList = before.inputList ?? [];
  const afterList = after.inputList ?? [];
  const inputLen = Math.max(beforeList.length, afterList.length);
  for (let i = 0; i < inputLen; i++) {
    const b = beforeList[i];
    const a = afterList[i];
    if (!b || !a) continue;
    const rowLabel = `Ch ${a.channelNumber} — ${a.source}`;
    const fields: (keyof typeof a)[] = ['source', 'sourceEn', 'micOrDi', 'standType', 'standNotes', 'notes'];
    for (const field of fields) {
      const bv = String(b[field] ?? '');
      const av = String(a[field] ?? '');
      if (bv !== av) changes.push({ rowLabel, field, before: bv, after: av });
    }
  }

  const beforeMix = before.monitorMix ?? [];
  const afterMix = after.monitorMix ?? [];
  const mixLen = Math.max(beforeMix.length, afterMix.length);
  for (let i = 0; i < mixLen; i++) {
    const b = beforeMix[i];
    const a = afterMix[i];
    if (!b || !a) continue;
    const rowLabel = `Mix ${a.outputs} — ${a.mixName}`;
    const fields: (keyof typeof a)[] = ['outputs', 'mixName', 'personName', 'type', 'notes'];
    for (const field of fields) {
      const bv = String(b[field] ?? '');
      const av = String(a[field] ?? '');
      if (bv !== av) changes.push({ rowLabel, field, before: bv, after: av });
    }
  }

  const beforeFoh = before.fohOutputs ?? [];
  const afterFoh = after.fohOutputs ?? [];
  const fohLen = Math.max(beforeFoh.length, afterFoh.length);
  for (let i = 0; i < fohLen; i++) {
    const b = beforeFoh[i];
    const a = afterFoh[i];
    if (!b || !a) continue;
    const rowLabel = `Out ${a.outputNumber} — ${a.source}`;
    const fields: (keyof typeof a)[] = ['outputNumber', 'source', 'notes'];
    for (const field of fields) {
      const bv = String(b[field] ?? '');
      const av = String(a[field] ?? '');
      if (bv !== av) changes.push({ rowLabel, field, before: bv, after: av });
    }
  }

  if ((before.freeText ?? '') !== (after.freeText ?? '')) {
    changes.push({ rowLabel: 'Free text', field: 'freeText', before: before.freeText ?? '', after: after.freeText ?? '' });
  }
  if ((before.freeTextEn ?? '') !== (after.freeTextEn ?? '')) {
    changes.push({ rowLabel: 'Free text (EN)', field: 'freeTextEn', before: before.freeTextEn ?? '', after: after.freeTextEn ?? '' });
  }

  return changes;
}

function computeVisibilityChanges(before: Visibility, after: Visibility): FieldChange[] {
  const changes: FieldChange[] = [];

  if (before.default !== after.default) {
    changes.push({ rowLabel: 'Default', field: 'level', before: before.default, after: after.default });
  }

  const levels = ['groups', 'tags', 'persons'] as const;
  const labels = { groups: 'Group', tags: 'Tag', persons: 'Person' } as const;
  for (const level of levels) {
    const b = before[level] ?? {};
    const a = after[level] ?? {};
    for (const id of new Set([...Object.keys(b), ...Object.keys(a)])) {
      const bv = b[id] ?? '';
      const av = a[id] ?? '';
      if (bv !== av) {
        changes.push({ rowLabel: `${labels[level]}: ${id}`, field: 'level', before: bv, after: av });
      }
    }
  }

  return changes;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  // Read persisted scratch state once, lazily. Scratch is the default mode, so
  // a scratch shell is created up front when none was restored.
  // The tour is restored from localStorage, or a fresh empty shell when none
  // was stored — the build-from-scratch onboarding starts from the shell.
  const [tour, setTour] = useState<Tour>(() => loadScratchTour() ?? createScratchTour());
  // Restore the overlay bundle (visibility edits, lock state, section
  // approvals / history, conflict resolutions, viewer choice). One read,
  // distributed into each state slot below.
  const initialOverlays = useMemo(() => loadOverlays(), []);
  const [userKey, setUserKey] = useState<string>(
    () => initialOverlays?.userKey ?? scratchDefaultUserKey(tour),
  );
  const [densityMode, setDensityMode] = useState<DensityMode>(getInitialDensityMode);
  const [lockedDays, setLockedDays] = useState<ReadonlySet<ID>>(
    () => new Set(initialOverlays?.lockedDays ?? []),
  );
  const [resolvedConflicts, setResolvedConflicts] = useState<ReadonlyMap<ID, ConflictResolution>>(
    () => new Map(initialOverlays?.resolvedConflicts ?? []),
  );
  const [dayUpdates, setDayUpdates] = useState<ReadonlyMap<ID, UpdateStamp>>(
    () => new Map(initialOverlays?.dayUpdates ?? []),
  );
  const [sectionApprovals, setSectionApprovals] = useState<ReadonlyMap<string, UpdateStamp>>(
    () => new Map(initialOverlays?.sectionApprovals ?? []),
  );
  const [sectionEdits, setSectionEdits] = useState<ReadonlyMap<string, RiderSectionEdit>>(
    () => new Map(initialOverlays?.sectionEdits ?? []),
  );
  const [pendingEdits, setPendingEdits] = useState<ReadonlyMap<string, PendingEdit>>(
    () => new Map(initialOverlays?.pendingEdits ?? []),
  );
  const [pendingConflictResolutions, setPendingConflictResolutions] = useState<ReadonlyMap<ID, PendingConflictResolution>>(
    () => new Map(initialOverlays?.pendingConflictResolutions ?? []),
  );
  const [sectionEditHistory, setSectionEditHistory] = useState<ReadonlyMap<string, SectionEditRecord[]>>(
    () => new Map(initialOverlays?.sectionEditHistory ?? []),
  );
  const [dayLockHistory, setDayLockHistory] = useState<ReadonlyMap<ID, DayLockRecord[]>>(
    () => new Map(initialOverlays?.dayLockHistory ?? []),
  );
  const [visibilityEdits, setVisibilityEdits] = useState<ReadonlyMap<ID, Visibility>>(
    () => new Map(initialOverlays?.visibilityEdits ?? []),
  );
  const [pendingVisibilityEdits, setPendingVisibilityEdits] = useState<ReadonlyMap<ID, PendingVisibilityEdit>>(
    () => new Map(initialOverlays?.pendingVisibilityEdits ?? []),
  );
  const [visibilityEditHistory, setVisibilityEditHistory] = useState<ReadonlyMap<ID, VisibilityEditRecord[]>>(
    () => new Map(initialOverlays?.visibilityEditHistory ?? []),
  );
  const [flightPassengerResolutions, setFlightPassengerResolutionsMap] = useState<
    ReadonlyMap<string, FlightPassengerResolution>
  >(() => new Map(initialOverlays?.flightPassengerResolutions ?? []));

  useEffect(() => {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, densityMode);
  }, [densityMode]);

  // Persist the tour so a reload resumes where the user left off.
  useEffect(() => {
    saveScratchTour(tour);
  }, [tour]);

  // Persist the overlay bundle — every Map/Set above. Each write replaces the
  // whole bundle (small payload — entry arrays of typed records).
  useEffect(() => {
    saveOverlays({
      lockedDays: [...lockedDays],
      resolvedConflicts: [...resolvedConflicts.entries()],
      dayUpdates: [...dayUpdates.entries()],
      sectionApprovals: [...sectionApprovals.entries()],
      sectionEdits: [...sectionEdits.entries()],
      pendingEdits: [...pendingEdits.entries()],
      pendingConflictResolutions: [...pendingConflictResolutions.entries()],
      sectionEditHistory: [...sectionEditHistory.entries()],
      dayLockHistory: [...dayLockHistory.entries()],
      visibilityEdits: [...visibilityEdits.entries()],
      pendingVisibilityEdits: [...pendingVisibilityEdits.entries()],
      visibilityEditHistory: [...visibilityEditHistory.entries()],
      flightPassengerResolutions: [...flightPassengerResolutions.entries()],
      userKey,
    });
  }, [
    lockedDays,
    resolvedConflicts,
    dayUpdates,
    sectionApprovals,
    sectionEdits,
    pendingEdits,
    pendingConflictResolutions,
    sectionEditHistory,
    dayLockHistory,
    visibilityEdits,
    pendingVisibilityEdits,
    visibilityEditHistory,
    flightPassengerResolutions,
    userKey,
  ]);

  // Viewer-switcher options — derived from the tour's own personnel, so the
  // list grows as imports add crew.
  const allUsers = useMemo<Record<string, CurrentUser>>(() => scratchUsers(tour), [tour]);
  const user = allUsers[userKey] ?? Object.values(allUsers)[0];
  const currentName = user.name;

  // Reset wipes the tour back to the empty onboarding shell AND clears every
  // overlay (lock state, visibility edits, section approvals, history, …) so
  // the user truly starts from scratch.
  const resetScratchTour = useCallback(() => {
    const t = createScratchTour();
    setTour(t);
    setUserKey(scratchDefaultUserKey(t));
    setLockedDays(new Set());
    setResolvedConflicts(new Map());
    setDayUpdates(new Map());
    setSectionApprovals(new Map());
    setSectionEdits(new Map());
    setPendingEdits(new Map());
    setPendingConflictResolutions(new Map());
    setSectionEditHistory(new Map());
    setDayLockHistory(new Map());
    setVisibilityEdits(new Map());
    setPendingVisibilityEdits(new Map());
    setVisibilityEditHistory(new Map());
    setFlightPassengerResolutionsMap(new Map());
    clearOverlays();
  }, []);

  // ---- Tour mutators -------------------------------------------------------
  const updateScratchTour = useCallback((updater: (t: Tour) => Tour) => {
    setTour((prev) => updater(prev));
  }, []);
  const applyRouteToScratch = useCallback(
    (parsed: ParsedRoute) => {
      updateScratchTour((t) => ({
        ...t,
        legs: parsed.legs,
        days: parsed.days,
        scheduleItems: parsed.scheduleItems,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        status: 'in_progress',
        routeImport: {
          at: MOCK_NOW,
          by: currentName,
          updates: (t.routeImport?.updates ?? 0) + (t.routeImport ? 1 : 0),
        },
      }));
    },
    [updateScratchTour, currentName],
  );
  const addRiderImportToScratch = useCallback(
    (ri: RiderImport, newPersonnel: TourPerson[]) => {
      const stamped: RiderImport = { ...ri, uploadedBy: ri.uploadedBy ?? currentName };
      updateScratchTour((t) => {
        const existing = new Set(t.personnel.map((p) => p.id));
        return {
          ...t,
          riderImports: [stamped],
          artistName: stamped.artistName ?? t.artistName,
          personnel: [...t.personnel, ...newPersonnel.filter((p) => !existing.has(p.id))],
        };
      });
      // Seed approvals for sections the rider marks already-approved (parity
      // with demo mode) so the review surface shows a realistic mixed state.
      setSectionApprovals((prev) => {
        const next = new Map(prev);
        ri.sections.forEach((s, i) => {
          if (s.status === 'approved') next.set(`${s.type}-${i}`, SEED_SECTION_APPROVAL);
        });
        return next;
      });
    },
    [updateScratchTour, currentName],
  );
  const addFlightImportToScratch = useCallback(
    (fi: FlightImport) => {
      updateScratchTour((t) => {
        const existing = t.flightImports.find((f) => f.id === fi.id);
        const stamped: FlightImport = {
          ...fi,
          uploadedBy: fi.uploadedBy ?? currentName,
          // Same-id re-upload (same fixture filename) counts as an update.
          updates: existing ? (existing.updates ?? 0) + 1 : (fi.updates ?? 0),
        };
        return {
          ...t,
          flightImports: [...t.flightImports.filter((f) => f.id !== stamped.id), stamped],
          // If we're replacing an already-imported FlightImport in place, the
          // previously-committed Travel records are stale — drop them so the
          // user re-approves the new data.
          travel: existing && existing.status === 'imported'
            ? t.travel.filter((tr) => !tr.id.startsWith(`tr_${existing.id}_`))
            : t.travel,
        };
      });
    },
    [updateScratchTour, currentName],
  );
  const resKey = (importId: ID, name: string) => `${importId}::${name.trim().toLowerCase()}`;
  const setFlightPassengerResolution = useCallback(
    (importId: ID, name: string, res: FlightPassengerResolution | null) => {
      setFlightPassengerResolutionsMap((prev) => {
        const next = new Map(prev);
        if (res === null) next.delete(resKey(importId, name));
        else next.set(resKey(importId, name), res);
        return next;
      });
    },
    [],
  );
  const getFlightPassengerResolution = useCallback(
    (importId: ID, name: string) => flightPassengerResolutions.get(resKey(importId, name)),
    [flightPassengerResolutions],
  );

  const commitFlightImportToScratch = useCallback(
    (importId: ID) => {
      updateScratchTour((t) => {
        const imp = t.flightImports.find((f) => f.id === importId);
        if (!imp) return t;

        // Apply per-passenger resolutions before building the Travel record:
        //   - 'assign' → link to the chosen existing TourPerson
        //   - 'add'    → create a placeholder TourPerson + link to it
        //   - 'skip' / no resolution → drop (legacy behavior)
        const personsToAdd: TourPerson[] = [];
        const usedSlugs = new Set(t.personnel.map((p) => p.id));
        const slugify = (name: string) => {
          let base = `tp_auto_${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
          let candidate = base;
          let n = 2;
          while (usedSlugs.has(candidate)) candidate = `${base}_${n++}`;
          usedSlugs.add(candidate);
          return candidate;
        };

        const newTravel: Travel[] = imp.parsedFlights.map((pf, i) => {
          const departDate = pf.departureTime.slice(0, 10);
          const day = t.days.find((d) => d.date === departDate);
          const passengers = pf.passengers.flatMap((p) => {
            if (p.matchedTourPersonId) {
              return [{ tourPersonId: p.matchedTourPersonId, seat: p.seat }];
            }
            const res = flightPassengerResolutions.get(resKey(importId, p.name));
            if (!res || res.action === 'skip') return [];
            if (res.action === 'assign' && res.tourPersonId) {
              return [{ tourPersonId: res.tourPersonId, seat: p.seat }];
            }
            if (res.action === 'add') {
              const tpId = slugify(p.name);
              const pId = `p_${tpId.slice(3)}`;
              personsToAdd.push({
                id: tpId,
                personId: pId,
                person: { id: pId, name: p.name },
                role: '',
                groupId: 'grp_band',
                tagIds: [],
                startDate: '',
                endDate: '',
                isPlaceholder: true,
              });
              return [{ tourPersonId: tpId, seat: p.seat }];
            }
            return [];
          });
          return {
            id: `tr_${imp.id}_${i}`,
            dayId: day?.id ?? '',
            mode: 'flight',
            carrier: pf.airline,
            identifier: pf.flightNumber,
            from: pf.departureAirport,
            to: pf.arrivalAirport,
            departTime: pf.departureTime.slice(11, 16),
            arriveTime: pf.arrivalTime.slice(11, 16),
            recordLocator: pf.recordLocator,
            passengers,
            visibility: vis.everyone('sees'),
          };
        });
        return {
          ...t,
          personnel: [...t.personnel, ...personsToAdd],
          travel: [
            ...t.travel.filter((tr) => !tr.id.startsWith(`tr_${imp.id}_`)),
            ...newTravel,
          ],
          flightImports: t.flightImports.map((f) =>
            f.id === importId ? { ...f, status: 'imported' } : f,
          ),
        };
      });
    },
    [updateScratchTour, flightPassengerResolutions],
  );

  const addHotelImportToScratch = useCallback(
    (hotels: Hotel[], tasks: Task[]) => {
      updateScratchTour((t) => {
        const hotelIds = new Set(hotels.map((h) => h.id));
        const taskIds = new Set(tasks.map((tk) => tk.id));
        return {
          ...t,
          hotels: [...t.hotels.filter((h) => !hotelIds.has(h.id)), ...hotels],
          tasks: [...t.tasks.filter((tk) => !taskIds.has(tk.id)), ...tasks],
          hotelImport: {
            at: MOCK_NOW,
            by: currentName,
            updates: (t.hotelImport?.updates ?? 0) + (t.hotelImport ? 1 : 0),
          },
        };
      });
    },
    [updateScratchTour, currentName],
  );

  // ---- Cancel / re-import -------------------------------------------------
  // Each "Remove" wipes only what its step laid down, so a user who picked the
  // wrong file can back out without trashing the rest of the tour. The audit
  // stamp on the empty state records who/when cancelled (reason captured in
  // the UI confirm modal — kept locally for now, server-side log later).
  const cancelRouteImport = useCallback(
    (_reason?: string) => {
      updateScratchTour((t) => ({
        ...t,
        legs: [],
        days: [],
        scheduleItems: [],
        travel: [],
        startDate: t.startDate,
        endDate: t.endDate,
        routeImport: undefined,
      }));
    },
    [updateScratchTour],
  );
  const cancelRiderImport = useCallback(
    (id: ID, _reason?: string) => {
      updateScratchTour((t) => ({
        ...t,
        riderImports: t.riderImports.filter((r) => r.id !== id),
      }));
    },
    [updateScratchTour],
  );
  const discardFlightImport = useCallback(
    (id: ID, _reason?: string) => {
      updateScratchTour((t) => ({
        ...t,
        flightImports: t.flightImports.filter((f) => f.id !== id),
        // Also drop any Travel records this import committed (if it had been
        // approved). `tr_${id}_…` is the namespace from commitFlightImportToScratch.
        travel: t.travel.filter((tr) => !tr.id.startsWith(`tr_${id}_`)),
      }));
      // Drop any pending resolutions for this import too.
      setFlightPassengerResolutionsMap((prev) => {
        const next = new Map(prev);
        for (const k of next.keys()) if (k.startsWith(`${id}::`)) next.delete(k);
        return next;
      });
    },
    [updateScratchTour],
  );
  const replaceFlightImport = useCallback(
    (existingId: ID, incomingId: ID) => {
      updateScratchTour((t) => {
        const existing = t.flightImports.find((f) => f.id === existingId);
        return {
          ...t,
          flightImports: t.flightImports
            .filter((f) => f.id !== existingId)
            .map((f) =>
              f.id === incomingId
                // Incoming becomes canonical — carry the update history forward.
                ? { ...f, updates: (existing?.updates ?? 0) + 1 }
                : f,
            ),
          travel: t.travel.filter((tr) => !tr.id.startsWith(`tr_${existingId}_`)),
        };
      });
      setFlightPassengerResolutionsMap((prev) => {
        const next = new Map(prev);
        for (const k of next.keys()) if (k.startsWith(`${existingId}::`)) next.delete(k);
        return next;
      });
    },
    [updateScratchTour],
  );
  const mergeFlightImport = useCallback(
    (existingId: ID, incomingId: ID) => {
      updateScratchTour((t) => {
        const existing = t.flightImports.find((f) => f.id === existingId);
        const incoming = t.flightImports.find((f) => f.id === incomingId);
        if (!existing || !incoming) return t;

        // Merge passenger lists by lowercased name. Matching name → updated
        // seat (incoming wins). New name → appended. Metadata from `incoming`
        // wins (it's the more recent upload).
        const merged = existing.parsedFlights.map((pfExisting, idx) => {
          const pfIncoming = incoming.parsedFlights[idx] ?? incoming.parsedFlights[0];
          if (!pfIncoming) return pfExisting;
          const byName = new Map(
            pfExisting.passengers.map((p) => [p.name.trim().toLowerCase(), p]),
          );
          for (const p of pfIncoming.passengers) {
            const key = p.name.trim().toLowerCase();
            const prev = byName.get(key);
            byName.set(key, {
              name: prev?.name ?? p.name,
              seat: p.seat ?? prev?.seat,
              matchedTourPersonId: prev?.matchedTourPersonId ?? p.matchedTourPersonId,
            });
          }
          return {
            ...pfExisting,
            departureTime: pfIncoming.departureTime,
            arrivalTime: pfIncoming.arrivalTime,
            recordLocator: pfIncoming.recordLocator ?? pfExisting.recordLocator,
            passengers: [...byName.values()],
          };
        });
        const wasImported = existing.status === 'imported';
        const mergedImport: FlightImport = {
          ...existing,
          parsedFlights: merged,
          unmatchedNames: merged.flatMap((pf) =>
            pf.passengers.filter((p) => !p.matchedTourPersonId).map((p) => p.name),
          ),
          uploadedAt: MOCK_NOW,
          uploadedBy: currentName,
          updates: (existing.updates ?? 0) + 1,
          // If the existing import was already committed, the merged data
          // makes its Travel stale — back to review so the user re-approves.
          status: wasImported ? 'review' : existing.status,
        };
        return {
          ...t,
          flightImports: t.flightImports
            .filter((f) => f.id !== incomingId)
            .map((f) => (f.id === existingId ? mergedImport : f)),
          travel: wasImported
            ? t.travel.filter((tr) => !tr.id.startsWith(`tr_${existing.id}_`))
            : t.travel,
        };
      });
      setFlightPassengerResolutionsMap((prev) => {
        const next = new Map(prev);
        for (const k of next.keys()) if (k.startsWith(`${incomingId}::`)) next.delete(k);
        return next;
      });
    },
    [updateScratchTour, currentName],
  );

  // ---- Schedule-type visibility defaults ----------------------------------
  const getScheduleTypeDefault = useCallback(
    (type: ScheduleItemType): Visibility =>
      tour.visibilityDefaultsByType?.[type] ?? defaultVisibilityForType(type),
    [tour.visibilityDefaultsByType],
  );
  const setScheduleTypeDefault = useCallback(
    (type: ScheduleItemType, v: Visibility) => {
      updateScratchTour((t) => ({
        ...t,
        visibilityDefaultsByType: { ...(t.visibilityDefaultsByType ?? {}), [type]: v },
      }));
    },
    [updateScratchTour],
  );

  const applyTypeTemplateToAllItems = useCallback(
    (type: ScheduleItemType): number => {
      const template = getScheduleTypeDefault(type);
      const matching = tour.scheduleItems.filter((i) => i.type === type);
      if (matching.length === 0) return 0;
      setVisibilityEdits((prev) => {
        const next = new Map(prev);
        for (const item of matching) next.set(item.id, template);
        return next;
      });
      setVisibilityEditHistory((prev) => {
        const next = new Map(prev);
        for (const item of matching) {
          const before = visibilityEdits.get(item.id) ?? item.visibility;
          const record: VisibilityEditRecord = {
            patch: template,
            changes: computeVisibilityChanges(before, template),
            status: 'direct',
            resolvedAt: { at: MOCK_NOW, by: currentName },
          };
          next.set(item.id, [...(prev.get(item.id) ?? []), record]);
        }
        return next;
      });
      return matching.length;
    },
    [getScheduleTypeDefault, tour.scheduleItems, visibilityEdits, currentName],
  );

  const saveVisibilityForType = useCallback(
    (type: ScheduleItemType, patch: Visibility): number => {
      const matching = tour.scheduleItems.filter((i) => i.type === type);
      if (matching.length === 0) return 0;
      // Cascade to every existing item of this type.
      setVisibilityEdits((prev) => {
        const next = new Map(prev);
        for (const item of matching) next.set(item.id, patch);
        return next;
      });
      // Per-item history entries so the audit trail captures the cascade.
      setVisibilityEditHistory((prev) => {
        const next = new Map(prev);
        for (const item of matching) {
          const before = visibilityEdits.get(item.id) ?? item.visibility;
          const record: VisibilityEditRecord = {
            patch,
            changes: computeVisibilityChanges(before, patch),
            status: 'direct',
            resolvedAt: { at: MOCK_NOW, by: currentName },
          };
          next.set(item.id, [...(prev.get(item.id) ?? []), record]);
        }
        return next;
      });
      // Bump the tour-level template so future items of this type inherit.
      updateScratchTour((t) => ({
        ...t,
        visibilityDefaultsByType: { ...(t.visibilityDefaultsByType ?? {}), [type]: patch },
      }));
      return matching.length;
    },
    [tour.scheduleItems, visibilityEdits, currentName, updateScratchTour],
  );

  const cancelHotelImport = useCallback(
    (_reason?: string) => {
      updateScratchTour((t) => ({
        ...t,
        hotels: [],
        // Drop only hotel-advance tasks the import laid down. Their ids are
        // namespaced `tk_hotel_…` in hotelFixture.ts.
        tasks: t.tasks.filter((tk) => !tk.id.startsWith('tk_hotel_')),
        hotelImport: undefined,
      }));
    },
    [updateScratchTour],
  );

  // ---- Tour query helpers, bound to the active tour -----------------------
  const getDay = useCallback((date: string) => tourQueries.getDay(tour, date), [tour]);
  const getDayById = useCallback((id: ID) => tourQueries.getDayById(tour, id), [tour]);
  const getScheduleItemsForDay = useCallback(
    (dayId: ID) => {
      const items = tourQueries.getScheduleItemsForDay(tour, dayId);
      if (visibilityEdits.size === 0) return items;
      // Layer the manager's saved visibility overlay onto each item so
      // downstream filters (DayDetail / DaySheets / TodaySurface) resolve
      // against the *current* visibility, not the seed.
      return items.map((it) => {
        const override = visibilityEdits.get(it.id);
        return override ? { ...it, visibility: override } : it;
      });
    },
    [tour, visibilityEdits],
  );
  const getTravelForDay = useCallback(
    (dayId: ID) => tourQueries.getTravelForDay(tour, dayId),
    [tour],
  );
  const getHotelsForDay = useCallback(
    (dayId: ID) => tourQueries.getHotelsForDay(tour, dayId),
    [tour],
  );
  const getTasksForDay = useCallback(
    (dayId: ID) => tourQueries.getTasksForDay(tour, dayId),
    [tour],
  );
  const getTourPersonById = useCallback(
    (id: ID) => tourQueries.getTourPersonById(tour, id),
    [tour],
  );
  const getGroupById = useCallback((id: ID) => tourQueries.getGroupById(tour, id), [tour]);
  const getGroupTagById = useCallback(
    (id: ID) => tourQueries.getGroupTagById(tour, id),
    [tour],
  );
  const getAllConflicts = useCallback(() => tourQueries.getAllConflicts(tour), [tour]);

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
  const recordLock = useCallback(
    (dayId: ID, locked: boolean, reason?: string) => {
      setDayLockHistory((prev) => {
        const next = new Map(prev);
        const record: DayLockRecord = {
          locked,
          reason,
          stamp: { at: MOCK_NOW, by: currentName },
        };
        next.set(dayId, [...(prev.get(dayId) ?? []), record]);
        return next;
      });
    },
    [currentName],
  );
  const toggleDayLocked = useCallback(
    (dayId: ID, reason?: string) => {
      let nowLocked = false;
      setLockedDays((prev) => {
        const next = new Set(prev);
        if (next.has(dayId)) {
          next.delete(dayId);
          nowLocked = false;
        } else {
          next.add(dayId);
          nowLocked = true;
        }
        return next;
      });
      recordLock(dayId, nowLocked, reason);
      stampDay(dayId);
    },
    [recordLock, stampDay],
  );
  const setDayLocked = useCallback(
    (dayId: ID, locked: boolean, reason?: string) => {
      let changed = false;
      setLockedDays((prev) => {
        const has = prev.has(dayId);
        if (has === locked) return prev;
        changed = true;
        const next = new Set(prev);
        if (locked) next.add(dayId);
        else next.delete(dayId);
        return next;
      });
      if (changed) {
        recordLock(dayId, locked, reason);
        stampDay(dayId);
      }
    },
    [recordLock, stampDay],
  );
  const getDayLockHistory = useCallback(
    (dayId: ID): DayLockRecord[] => dayLockHistory.get(dayId) ?? [],
    [dayLockHistory],
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

  const updateSectionEdit = useCallback((key: string, patch: RiderSectionEdit, before?: RiderSectionEdit) => {
    setSectionEdits((prev) => {
      const next = new Map(prev);
      next.set(key, { ...next.get(key), ...patch });
      return next;
    });
    if (before) {
      const changes = computeSectionChanges(before, patch);
      setSectionEditHistory((prev) => {
        const next = new Map(prev);
        const record: SectionEditRecord = {
          patch,
          changes,
          status: 'direct',
          resolvedAt: { at: MOCK_NOW, by: currentName },
        };
        next.set(key, [...(prev.get(key) ?? []), record]);
        return next;
      });
    }
  }, [currentName]);

  const getPendingEdit = useCallback(
    (key: string) => pendingEdits.get(key),
    [pendingEdits],
  );

  const proposeSectionEdit = useCallback((key: string, patch: RiderSectionEdit, before: RiderSectionEdit) => {
    setPendingEdits((prev) => {
      const next = new Map(prev);
      const existing = next.get(key);
      next.set(key, {
        key,
        patch: { ...existing?.patch, ...patch },
        before,
        proposedAt: { at: MOCK_NOW, by: currentName },
      });
      return next;
    });
  }, [currentName]);

  const approvePendingEdit = useCallback((key: string) => {
    setPendingEdits((prev) => {
      const pending = prev.get(key);
      if (!pending) return prev;
      setSectionEdits((ePrev) => {
        const next = new Map(ePrev);
        next.set(key, { ...next.get(key), ...pending.patch });
        return next;
      });
      setSectionEditHistory((hPrev) => {
        const changes = computeSectionChanges(pending.before, pending.patch);
        const record: SectionEditRecord = {
          patch: pending.patch,
          changes,
          proposedAt: pending.proposedAt,
          status: 'approved',
          resolvedAt: { at: MOCK_NOW, by: currentName },
        };
        const next = new Map(hPrev);
        next.set(key, [...(hPrev.get(key) ?? []), record]);
        return next;
      });
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, [currentName]);

  const rejectPendingEdit = useCallback((key: string) => {
    setPendingEdits((prev) => {
      const pending = prev.get(key);
      if (!pending) return prev;
      setSectionEditHistory((hPrev) => {
        const changes = computeSectionChanges(pending.before, pending.patch);
        const record: SectionEditRecord = {
          patch: pending.patch,
          changes,
          proposedAt: pending.proposedAt,
          status: 'rejected',
          resolvedAt: { at: MOCK_NOW, by: currentName },
        };
        const next = new Map(hPrev);
        next.set(key, [...(hPrev.get(key) ?? []), record]);
        return next;
      });
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, [currentName]);

  const getSectionHistory = useCallback(
    (key: string): SectionEditRecord[] => sectionEditHistory.get(key) ?? [],
    [sectionEditHistory],
  );

  const getVisibilityEdit = useCallback(
    (itemId: ID) => visibilityEdits.get(itemId),
    [visibilityEdits],
  );
  const updateVisibilityEdit = useCallback(
    (itemId: ID, patch: Visibility, before: Visibility) => {
      setVisibilityEdits((prev) => {
        const next = new Map(prev);
        next.set(itemId, patch);
        return next;
      });
      setVisibilityEditHistory((prev) => {
        const record: VisibilityEditRecord = {
          patch,
          changes: computeVisibilityChanges(before, patch),
          status: 'direct',
          resolvedAt: { at: MOCK_NOW, by: currentName },
        };
        const next = new Map(prev);
        next.set(itemId, [...(prev.get(itemId) ?? []), record]);
        return next;
      });
    },
    [currentName],
  );

  const getPendingVisibilityEdit = useCallback(
    (itemId: ID) => pendingVisibilityEdits.get(itemId),
    [pendingVisibilityEdits],
  );
  const proposeVisibilityEdit = useCallback(
    (itemId: ID, patch: Visibility, before: Visibility) => {
      setPendingVisibilityEdits((prev) => {
        const next = new Map(prev);
        next.set(itemId, {
          itemId,
          patch,
          before: prev.get(itemId)?.before ?? before,
          proposedAt: { at: MOCK_NOW, by: currentName },
        });
        return next;
      });
    },
    [currentName],
  );
  const approvePendingVisibilityEdit = useCallback((itemId: ID) => {
    setPendingVisibilityEdits((prev) => {
      const pending = prev.get(itemId);
      if (!pending) return prev;
      setVisibilityEdits((ePrev) => {
        const next = new Map(ePrev);
        next.set(itemId, pending.patch);
        return next;
      });
      setVisibilityEditHistory((hPrev) => {
        const record: VisibilityEditRecord = {
          patch: pending.patch,
          changes: computeVisibilityChanges(pending.before, pending.patch),
          proposedAt: pending.proposedAt,
          status: 'approved',
          resolvedAt: { at: MOCK_NOW, by: currentName },
        };
        const next = new Map(hPrev);
        next.set(itemId, [...(hPrev.get(itemId) ?? []), record]);
        return next;
      });
      const next = new Map(prev);
      next.delete(itemId);
      return next;
    });
  }, [currentName]);
  const rejectPendingVisibilityEdit = useCallback((itemId: ID) => {
    setPendingVisibilityEdits((prev) => {
      const pending = prev.get(itemId);
      if (!pending) return prev;
      setVisibilityEditHistory((hPrev) => {
        const record: VisibilityEditRecord = {
          patch: pending.patch,
          changes: computeVisibilityChanges(pending.before, pending.patch),
          proposedAt: pending.proposedAt,
          status: 'rejected',
          resolvedAt: { at: MOCK_NOW, by: currentName },
        };
        const next = new Map(hPrev);
        next.set(itemId, [...(hPrev.get(itemId) ?? []), record]);
        return next;
      });
      const next = new Map(prev);
      next.delete(itemId);
      return next;
    });
  }, [currentName]);
  const getVisibilityHistory = useCallback(
    (itemId: ID): VisibilityEditRecord[] => visibilityEditHistory.get(itemId) ?? [],
    [visibilityEditHistory],
  );

  const getPendingConflictResolution = useCallback(
    (id: ID) => pendingConflictResolutions.get(id),
    [pendingConflictResolutions],
  );
  const proposeConflictResolution = useCallback(
    (id: ID, resolution: Omit<PendingConflictResolution, 'conflictId' | 'proposedAt'>) => {
      setPendingConflictResolutions((prev) => {
        const next = new Map(prev);
        next.set(id, { conflictId: id, ...resolution, proposedAt: { at: MOCK_NOW, by: currentName } });
        return next;
      });
    },
    [currentName],
  );
  const approvePendingConflictResolution = useCallback(
    (id: ID) => {
      const pending = pendingConflictResolutions.get(id);
      if (!pending) return;
      resolveConflict(id, {
        chosenValue: pending.chosenValue,
        source: pending.source,
        note: pending.note,
        proposedAt: pending.proposedAt,
      });
      setPendingConflictResolutions((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    },
    [pendingConflictResolutions, resolveConflict],
  );
  const rejectPendingConflictResolution = useCallback(
    (id: ID) => {
      setPendingConflictResolutions((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    },
    [],
  );

  const value = useMemo<AppState>(
    () => ({
      tour,
      user,
      userKey,
      setUserKey,
      allUsers,
      densityMode,
      setDensityMode,
      resetScratchTour,
      applyRouteToScratch,
      addRiderImportToScratch,
      addFlightImportToScratch,
      commitFlightImportToScratch,
      addHotelImportToScratch,
      cancelRouteImport,
      cancelRiderImport,
      discardFlightImport,
      cancelHotelImport,
      replaceFlightImport,
      mergeFlightImport,
      flightPassengerResolutions,
      setFlightPassengerResolution,
      getFlightPassengerResolution,
      getScheduleTypeDefault,
      setScheduleTypeDefault,
      applyTypeTemplateToAllItems,
      saveVisibilityForType,
      getDay,
      getDayById,
      getScheduleItemsForDay,
      getTravelForDay,
      getHotelsForDay,
      getTasksForDay,
      getTourPersonById,
      getGroupById,
      getGroupTagById,
      getAllConflicts,
      lockedDays,
      isDayLocked,
      toggleDayLocked,
      setDayLocked,
      dayLockHistory,
      getDayLockHistory,
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
      getPendingEdit,
      proposeSectionEdit,
      approvePendingEdit,
      rejectPendingEdit,
      getSectionHistory,
      pendingConflictResolutions,
      getPendingConflictResolution,
      proposeConflictResolution,
      approvePendingConflictResolution,
      rejectPendingConflictResolution,
      visibilityEdits,
      getVisibilityEdit,
      updateVisibilityEdit,
      pendingVisibilityEdits,
      getPendingVisibilityEdit,
      proposeVisibilityEdit,
      approvePendingVisibilityEdit,
      rejectPendingVisibilityEdit,
      getVisibilityHistory,
    }),
    [tour, user, userKey, allUsers, densityMode, resetScratchTour, applyRouteToScratch, addRiderImportToScratch, addFlightImportToScratch, commitFlightImportToScratch, addHotelImportToScratch, getDay, getDayById, getScheduleItemsForDay, getTravelForDay, getHotelsForDay, getTasksForDay, getTourPersonById, getGroupById, getGroupTagById, getAllConflicts, lockedDays, isDayLocked, toggleDayLocked, setDayLocked, dayLockHistory, getDayLockHistory, getDayLastUpdated, resolvedConflicts, resolveConflict, unresolveConflict, isSectionApproved, getSectionApproval, approveSection, reopenSection, getSectionEdit, updateSectionEdit, getPendingEdit, proposeSectionEdit, approvePendingEdit, rejectPendingEdit, getSectionHistory, pendingConflictResolutions, getPendingConflictResolution, proposeConflictResolution, approvePendingConflictResolution, rejectPendingConflictResolution, visibilityEdits, getVisibilityEdit, updateVisibilityEdit, pendingVisibilityEdits, getPendingVisibilityEdit, proposeVisibilityEdit, approvePendingVisibilityEdit, rejectPendingVisibilityEdit, getVisibilityHistory],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}
