import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createScratchTour, scratchUsers, scratchDefaultUserKey } from '@/data/scratchTour';
import { loadScratchTour } from '@/lib/scratchStorage';
import { loadOverlays, clearOverlays, type OverlayBundle } from '@/lib/overlayStorage';
import { clearAllRiderPdfs } from '@/lib/riderPdfStore';
import { clearAllDocuments } from '@/lib/documentStore';
import { backend, BACKEND_KIND } from '@/lib/backend';
import { useAuth } from '@/state/AuthProvider';
import { isOwnerFloorRole } from '@/lib/access';
import * as tourQueries from '@/lib/tourQueries';
import type { ParsedRoute } from '@/lib/routeCsv';
import { vis } from '@/lib/visibility';
import { getNowIso } from '@/lib/today';
import { FLIGHT_COST_BY_LEG } from '@/data/flightFixture';
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
  ScheduleItemPatch,
  ScheduleItemEditRecord,
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
  GearItem,
  DocumentSubmission,
  SubmissionType,
  DocumentKind,
} from '@/types';
import { defaultVisibilityForType } from '@/lib/visibilityDefaults';
import { scheduleItemLabel } from '@/lib/format';

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
  // True only on the supabase backend while the cloud tour is loading; always
  // false on local. A render gate (AuthGate) shows a spinner until it clears.
  booting: boolean;
  user: CurrentUser;
  userKey: string;
  setUserKey: (k: string) => void;
  allUsers: Record<string, CurrentUser>;

  // The tour starts as an empty shell the user builds up by uploading fixture
  // files. Reset wipes it back to the shell. See CLAUDE.md "Data modes".
  resetScratchTour: () => void;
  applyRouteToScratch: (parsed: ParsedRoute, filename?: string) => void;
  addRiderImportToScratch: (ri: RiderImport, personnel: TourPerson[]) => void;
  /** Promote a stored rider revision to the active slot (riderImports[0]).
   *  Existing section approvals/edits are kept — they're keyed by section, not
   *  by import, so the user doesn't lose review work. */
  setActiveRider: (id: ID) => void;
  addFlightImportToScratch: (fi: FlightImport) => void;
  commitFlightImportToScratch: (importId: ID) => void;
  addHotelImportToScratch: (hotels: Hotel[], tasks: Task[], filename?: string) => void;

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

  /** Edit one parsed passenger on a flight import (pre-approval clean-up).
   *  Name edits re-run the personnel match — fixes typos that block matching.
   *  Seat edits are passthrough. `unmatchedNames` is re-derived after the patch. */
  editFlightImportPassenger: (
    importId: ID,
    legIndex: number,
    passengerIndex: number,
    patch: { name?: string; seat?: string },
  ) => void;
  /** Remove a parsed passenger from a flight import (junk-row clean-up).
   *  Use when the parser picked up a footer line or non-passenger row. */
  removeFlightImportPassenger: (importId: ID, legIndex: number, passengerIndex: number) => void;

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

  // Schedule-item content edits (times / title / location / notes / type) plus
  // add + delete. These mutate the tour directly (not an overlay) so every read
  // site reflects them; the audit log lives in `scheduleItemEditHistory`.
  // Manager-only surface today — no propose/approve yet.
  updateScheduleItem: (itemId: ID, patch: ScheduleItemPatch) => void;
  addScheduleItem: (dayId: ID, init?: Partial<ScheduleItem>) => ID;
  deleteScheduleItem: (itemId: ID) => void;
  getScheduleItemHistory: (itemId: ID) => ScheduleItemEditRecord[];

  // Personnel + groups — direct tour mutation (no propose/approve), mirroring
  // the schedule-item content edits. `addTourPerson` returns the new id.
  addTourPerson: (init: TourPersonInit) => ID;
  removeTourPerson: (id: ID) => void;
  updateTourPerson: (id: ID, patch: TourPersonPatch) => void;
  addGroup: (name: string, color: string) => ID;

  // Gear & supplies — a flat list of rider-sourced and manually-added items.
  // Status and cost are tracked here; the rider section is the source of truth
  // for item names/quantities. Persisted in the overlay bundle.
  gearItems: GearItem[];
  updateGearItem: (id: ID, patch: Partial<Omit<GearItem, 'id'>>) => void;
  addGearItem: (init: Omit<GearItem, 'id'>) => ID;
  deleteGearItem: (id: ID) => void;

  // Inline cost edits for Travel + Hotel records — surfaced on the
  // Supplies & Costs page. Mutate the tour directly.
  updateHotelCost: (id: ID, patch: Partial<Pick<Hotel, 'nightlyRate' | 'currency' | 'taxRate'>>) => void;
  updateTravelCost: (id: ID, patch: Partial<Pick<Travel, 'costPerPassenger' | 'currency'>>) => void;

  // ── Document submissions (Milestone 2) ──
  // Crew submit any document for manager review; it lands as `pending` and only
  // a manager approves (attaches it to the tour) or rejects. On `local` these
  // live in the overlay bundle so the flow is testable; on `supabase` they go
  // through the backend (RLS-enforced: crew see only their own).
  submissions: DocumentSubmission[];
  /** Re-fetch submissions from the backend (supabase only; no-op on local). */
  refreshSubmissions: () => Promise<void>;
  /** Submit a document for review. Stores the file (if any), then records the
   *  pending submission. Returns the created submission or null. */
  proposeSubmission: (
    init: { type: SubmissionType; title: string; description?: string },
    file?: File,
  ) => Promise<DocumentSubmission | null>;
  /** Manager approves — flips status, stamps reviewer, and records the note. */
  approveSubmission: (id: ID, note?: string) => Promise<void>;
  /** Manager rejects with a reason. */
  rejectSubmission: (id: ID, reason: string) => Promise<void>;
  /** Object URL for a submission's stored file, or null if none. Caller revokes. */
  loadSubmissionFileUrl: (sub: DocumentSubmission) => Promise<string | null>;
  /** Append a Document to the tour (used when approving a document submission).
   *  Returns the new document id. */
  addDocument: (init: { kind: DocumentKind; title: string; liveLink: string }) => ID;
}

export interface TourPersonInit {
  name: string;
  role: string;
  groupId: ID;
  tagIds?: ID[];
  startDate?: string;
  endDate?: string;
}

export interface TourPersonPatch {
  name?: string;
  role?: string;
  groupId?: ID;
  tagIds?: ID[];
  startDate?: string;
  endDate?: string;
}

const Ctx = createContext<AppState | null>(null);

// On the supabase backend, coalesce rapid tour/overlay edits into one DB write.
const SUPABASE_WRITE_DEBOUNCE_MS = 500;

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

function computeScheduleItemChanges(before: ScheduleItem, patch: ScheduleItemPatch): FieldChange[] {
  const changes: FieldChange[] = [];
  const fields: (keyof ScheduleItemPatch)[] = ['startTime', 'endTime', 'title', 'location', 'notes', 'type'];
  const rowLabel = patch.title ?? before.title;
  for (const field of fields) {
    if (!(field in patch)) continue;
    const bv = String(before[field] ?? '');
    const av = String(patch[field] ?? '');
    if (bv !== av) changes.push({ rowLabel, field, before: bv, after: av });
  }
  return changes;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const isSupabase = BACKEND_KIND === 'supabase';

  // Whether the signed-in user is a manager (owner/manager/production). On
  // `local` membership is the synthetic active TM, so this is always true and
  // every manager-gated path stays byte-identical to today.
  const membership = auth.membership;
  const isManagerMember = !membership || isOwnerFloorRole(membership.role);

  // On `local`: read persisted scratch state once, synchronously — behavior is
  // unchanged. On `supabase`: start from a fresh shell + `booting` flag and let
  // the cloud-boot effect below pull the real tour/overlays from the backend
  // once auth is signed-in. The synchronous local reads return null on
  // supabase (no localStorage), so the shell is the harmless starting point.
  const [tour, setTour] = useState<Tour>(() =>
    isSupabase ? createScratchTour() : loadScratchTour() ?? createScratchTour(),
  );
  const [booting, setBooting] = useState<boolean>(isSupabase);
  // Restore the overlay bundle (visibility edits, lock state, section
  // approvals / history, conflict resolutions, viewer choice). One read,
  // distributed into each state slot below.
  const initialOverlays = useMemo(() => (isSupabase ? null : loadOverlays()), [isSupabase]);
  // Debounce timers for supabase writes (no-op on local).
  const tourSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlaySaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [userKey, setUserKey] = useState<string>(
    () => initialOverlays?.userKey ?? scratchDefaultUserKey(tour),
  );
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
  const [scheduleItemEditHistory, setScheduleItemEditHistory] = useState<ReadonlyMap<ID, ScheduleItemEditRecord[]>>(
    () => new Map(initialOverlays?.scheduleItemEditHistory ?? []),
  );
  const [flightPassengerResolutions, setFlightPassengerResolutionsMap] = useState<
    ReadonlyMap<string, FlightPassengerResolution>
  >(() => new Map(initialOverlays?.flightPassengerResolutions ?? []));
  const [gearItems, setGearItems] = useState<GearItem[]>(
    () => initialOverlays?.gearItems ?? [],
  );
  // Document submissions. On `local` this is the source of truth (persisted in
  // the overlay bundle); on `supabase` it's a cache refreshed from the backend.
  const [submissions, setSubmissions] = useState<DocumentSubmission[]>(
    () => initialOverlays?.submissions ?? [],
  );

  // Persist the tour so a reload resumes where the user left off. On `local`
  // this is the synchronous localStorage write as before; on `supabase` writes
  // are debounced (see the debounce ref below) to avoid a DB round-trip on
  // every keystroke. While booting on supabase we skip writes so the cloud
  // tour isn't clobbered by the initial shell.
  useEffect(() => {
    if (booting) return;
    if (!isSupabase) {
      void backend.saveTour(tour);
      return;
    }
    // The shared tour is manager-writable only (RLS-enforced). Non-managers
    // read it live via the realtime subscription and never write it back.
    if (!isManagerMember) return;
    if (tourSaveTimer.current) clearTimeout(tourSaveTimer.current);
    tourSaveTimer.current = setTimeout(() => {
      void backend.saveTour(tour);
    }, SUPABASE_WRITE_DEBOUNCE_MS);
  }, [tour, booting, isSupabase, isManagerMember]);

  // Rehydrate every rider PDF's Blob URL after a reload. `scratchStorage` strips
  // `pdfObjectUrl` on save; the raw bytes live in IndexedDB keyed by import id.
  // Each rider (active + prior revisions) gets its bytes loaded, a fresh Blob
  // URL minted, and the URL patched back so the version-history "View PDF" links
  // and the embedded viewer keep working without a re-upload. Re-runs only when
  // the set of riders-missing-a-url changes (stable id:hasUrl fingerprint).
  const riderUrlState = tour.riderImports.map((r) => `${r.id}:${r.pdfObjectUrl ? '1' : '0'}`).join(',');
  useEffect(() => {
    const needsUrl = tour.riderImports.filter((r) => !r.pdfObjectUrl);
    if (needsUrl.length === 0) return;
    let cancelled = false;
    Promise.all(
      needsUrl.map(async (ri) => {
        const bytes = await backend.loadPdf('rider', ri.id);
        if (cancelled || !bytes) return null;
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        return { id: ri.id, url };
      }),
    )
      .then((results) => {
        if (cancelled) return;
        const updates = results.filter((r): r is { id: string; url: string } => r !== null);
        if (updates.length === 0) return;
        setTour((t) => ({
          ...t,
          riderImports: t.riderImports.map((ri) => {
            const match = updates.find((u) => u.id === ri.id);
            return match ? { ...ri, pdfObjectUrl: match.url } : ri;
          }),
        }));
      })
      .catch(() => {
        /* rehydrate failure is non-fatal — UI degrades to "no PDF" affordances */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riderUrlState]);

  // Re-derive plot data URLs after a reload. `scratchStorage` strips them on
  // save (base64 PNGs blow the localStorage quota), so a restored tour has
  // plot metadata but no images — render them once from the rider PDF.
  useEffect(() => {
    const ri = tour.riderImports[0];
    if (!ri) return;
    const needs = ri.sections.some((s) => s.plots?.some((p) => !p.dataUrl));
    if (!needs) return;
    let cancelled = false;
    (async () => {
      const { hydrateRiderPlotImages } = await import('@/data/riderFixture');
      const hydrated = await hydrateRiderPlotImages(ri);
      if (cancelled) return;
      setTour((t) => {
        // Bail if the import has been swapped in the meantime.
        if (t.riderImports[0]?.id !== ri.id) return t;
        return { ...t, riderImports: [hydrated, ...t.riderImports.slice(1)] };
      });
    })().catch(() => {
      /* render failure is non-fatal — UI just shows captions without images */
    });
    return () => {
      cancelled = true;
    };
    // Re-run only when the rider import id changes (a fresh upload or reset).
  }, [tour.riderImports[0]?.id]);

  // Seed or smart-merge gear items whenever the active rider changes. On first
  // import the list is empty — seed directly. On re-import (new rider version),
  // merge: keep user edits on existing items, update quantities, append new items.
  useEffect(() => {
    const ri = tour.riderImports[0];
    if (!ri) return;
    let cancelled = false;
    import('@/data/gearFixture').then(({ buildRiderGearItems, mergeGearItems }) => {
      if (cancelled) return;
      const fresh = buildRiderGearItems();
      setGearItems((cur) => (cur.length === 0 ? fresh : mergeGearItems(cur, fresh)));
    }).catch(() => { /* non-fatal */ });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour.riderImports[0]?.id]);

  // On supabase, pull the submissions the caller is allowed to see (own +,
  // for managers, all) once the tour is loaded. No-op on local (the overlay
  // array is already the source of truth). Re-runs when membership/tour change.
  useEffect(() => {
    if (!isSupabase || booting) return;
    if (auth.status !== 'signed-in' || membership?.status !== 'active') return;
    let cancelled = false;
    void backend.listSubmissions?.(tour.id).then((rows) => {
      if (!cancelled && rows) setSubmissions(rows);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupabase, booting, auth.status, membership?.status, membership?.uid, tour.id]);

  // The overlay bundle — every Map/Set above serialised to entry arrays.
  const overlayBundle = useMemo<OverlayBundle>(
    () => ({
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
      scheduleItemEditHistory: [...scheduleItemEditHistory.entries()],
      flightPassengerResolutions: [...flightPassengerResolutions.entries()],
      gearItems,
      submissions,
      userKey,
    }),
    [
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
      scheduleItemEditHistory,
      flightPassengerResolutions,
      gearItems,
      submissions,
      userKey,
    ],
  );

  // Distribute a restored overlay bundle into every state slot. Used by the
  // supabase cloud-boot effect; `local` distributes via the synchronous
  // initializers above instead.
  const distributeOverlays = useCallback((b: OverlayBundle | null) => {
    if (!b) return;
    setLockedDays(new Set(b.lockedDays ?? []));
    setResolvedConflicts(new Map(b.resolvedConflicts ?? []));
    setDayUpdates(new Map(b.dayUpdates ?? []));
    setSectionApprovals(new Map(b.sectionApprovals ?? []));
    setSectionEdits(new Map(b.sectionEdits ?? []));
    setPendingEdits(new Map(b.pendingEdits ?? []));
    setPendingConflictResolutions(new Map(b.pendingConflictResolutions ?? []));
    setSectionEditHistory(new Map(b.sectionEditHistory ?? []));
    setDayLockHistory(new Map(b.dayLockHistory ?? []));
    setVisibilityEdits(new Map(b.visibilityEdits ?? []));
    setPendingVisibilityEdits(new Map(b.pendingVisibilityEdits ?? []));
    setVisibilityEditHistory(new Map(b.visibilityEditHistory ?? []));
    setScheduleItemEditHistory(new Map(b.scheduleItemEditHistory ?? []));
    setFlightPassengerResolutionsMap(new Map(b.flightPassengerResolutions ?? []));
    if (b.gearItems) setGearItems(b.gearItems);
    if (b.submissions) setSubmissions(b.submissions);
    if (b.userKey) setUserKey(b.userKey);
  }, []);

  // Persist the overlay bundle. `local` writes synchronously to localStorage
  // (unchanged); `supabase` debounces a JSONB upsert. Skipped while booting so
  // the initial empty bundle doesn't clobber the cloud overlays.
  useEffect(() => {
    if (booting) return;
    if (!isSupabase) {
      void backend.saveOverlays(tour.id, overlayBundle);
      return;
    }
    // Overlays are tour-shared + manager-authored on supabase. Non-managers
    // never write them (RLS would reject anyway) — skip to avoid noisy failed
    // round-trips. Their userKey choice is the only per-user state, and that
    // isn't persisted server-side (stripped in saveOverlays).
    if (!isManagerMember) return;
    if (overlaySaveTimer.current) clearTimeout(overlaySaveTimer.current);
    overlaySaveTimer.current = setTimeout(() => {
      void backend.saveOverlays(tour.id, overlayBundle);
    }, SUPABASE_WRITE_DEBOUNCE_MS);
  }, [overlayBundle, booting, isSupabase, isManagerMember, tour.id]);

  // Cloud boot (supabase only): wait for sign-in, pull the tour + overlays from
  // the backend, seed a fresh scratch tour on first use, then clear `booting`.
  useEffect(() => {
    if (!isSupabase) return;
    if (auth.status !== 'signed-in') return;
    let cancelled = false;
    // First-emission guard: load overlays / seed exactly once. Later emissions
    // are realtime tour updates and only refresh `tour`.
    let firstHandled = false;
    const unsub = backend.subscribeTour(null, (cloudTour) => {
      if (cancelled) return;
      if (cloudTour) {
        setTour(cloudTour);
        if (!firstHandled) {
          firstHandled = true;
          void backend.loadOverlays(cloudTour.id).then((b) => {
            if (!cancelled) distributeOverlays(b);
          });
          setBooting(false);
        }
        return;
      }
      // No tour yet — the bootstrap manager creates + persists the shared shell
      // once. Use the membership's tour_id so the row matches what is_manager()
      // checks against (and so crew joining the same tour load the same row).
      // Falls back to a per-user id if no membership tour is known.
      if (!firstHandled) {
        firstHandled = true;
        const fresh = createScratchTour();
        const tid = auth.membership?.tourId || (auth.user?.uid ? `tour_${auth.user.uid}` : fresh.id);
        fresh.id = tid;
        setTour(fresh);
        setUserKey(scratchDefaultUserKey(fresh));
        void backend.saveTour(fresh);
        setBooting(false);
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupabase, auth.status]);

  // Viewer-switcher options — derived from the tour's own personnel, so the
  // list grows as imports add crew.
  const allUsers = useMemo<Record<string, CurrentUser>>(() => scratchUsers(tour), [tour]);

  // On supabase, the viewer is anchored to the signed-in user's membership:
  // managers may preview-as anyone (the TopBar switcher stays live, exactly
  // like local); non-managers are PINNED to their own identity (the switcher is
  // hidden for them — see TopBar). On `local`, membership is the synthetic
  // active TM (a manager), so this is a no-op and behavior is byte-identical.
  const membershipUser = useMemo<CurrentUser | null>(() => {
    if (!isSupabase) return null;
    if (!membership) {
      // Migrations not yet run — synthesize from the signed-in Google user so
      // the viewer chip shows the real name instead of the placeholder.
      if (!auth.user) return null;
      const fallback = Object.values(allUsers)[0];
      if (!fallback) return null;
      return { ...fallback, name: auth.user.displayName ?? auth.user.email ?? fallback.name };
    }
    // Prefer the linked TourPerson if it exists in the roster; otherwise fall
    // back to the membership's own fields so a not-yet-linked crew member still
    // resolves a sensible identity.
    const linked = membership.tourPersonId ? allUsers[membership.tourPersonId] : undefined;
    return (
      linked ?? {
        tourPersonId: membership.tourPersonId || `member_${membership.uid}`,
        name: membership.displayName,
        role: membership.role,
        groupId: membership.groupId || 'grp_mgmt',
        tagIds: membership.tagIds,
      }
    );
  }, [isSupabase, membership, allUsers, auth.user]);

  // Effective viewer: a non-manager on supabase is pinned to their membership
  // identity regardless of userKey; everyone else uses the userKey selection.
  // For managers: overlay their real identity onto the TM chip when it's selected.
  const _selected = allUsers[userKey] ?? Object.values(allUsers)[0];
  const user =
    isSupabase && membershipUser && !isManagerMember
      ? membershipUser
      : isSupabase && membershipUser && _selected?.tourPersonId === membershipUser.tourPersonId
        ? membershipUser
        : _selected;
  const currentName = user.name;

  // Reset wipes the tour back to the empty onboarding shell AND clears every
  // overlay (lock state, visibility edits, section approvals, history, …) so
  // the user truly starts from scratch.
  const resetScratchTour = useCallback(() => {
    const prevTourId = tour.id;
    const t = createScratchTour();
    // Keep the per-user tour id on supabase so reset re-seeds the same row.
    if (isSupabase) t.id = prevTourId;
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
    setScheduleItemEditHistory(new Map());
    setFlightPassengerResolutionsMap(new Map());
    setGearItems([]);
    setSubmissions([]);
    if (isSupabase) {
      // Wipe the cloud tour + overlays + PDFs, then re-seed the fresh shell.
      void backend.clearAll(prevTourId).then(() => backend.saveTour(t));
    } else {
      clearOverlays();
      void clearAllRiderPdfs();
      void clearAllDocuments();
    }
  }, [tour.id, isSupabase]);

  // ---- Tour mutators -------------------------------------------------------
  const updateScratchTour = useCallback((updater: (t: Tour) => Tour) => {
    setTour((prev) => updater(prev));
  }, []);
  const applyRouteToScratch = useCallback(
    (parsed: ParsedRoute, filename?: string) => {
      updateScratchTour((t) => ({
        ...t,
        legs: parsed.legs,
        days: parsed.days,
        scheduleItems: parsed.scheduleItems,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        status: 'in_progress',
        routeImportHistory: [
          ...(t.routeImportHistory ?? []),
          ...(t.routeImport ? [t.routeImport] : []),
        ],
        routeImport: {
          at: getNowIso(),
          by: currentName,
          updates: (t.routeImport?.updates ?? 0) + (t.routeImport ? 1 : 0),
          filename: filename ?? t.routeImport?.filename,
        },
      }));
    },
    [updateScratchTour, currentName],
  );
  const addRiderImportToScratch = useCallback(
    (ri: RiderImport, newPersonnel: TourPerson[]) => {
      updateScratchTour((t) => {
        const prevActive = t.riderImports[0];
        const stamped: RiderImport = {
          ...ri,
          uploadedBy: ri.uploadedBy ?? currentName,
          revision: (prevActive?.revision ?? 0) + 1,
          revisionOf: prevActive?.id,
        };
        const existing = new Set(t.personnel.map((p) => p.id));
        return {
          ...t,
          riderImports: [stamped, ...t.riderImports],
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
      // Gear seeding is handled by the useEffect below that watches
      // `tour.riderImports[0]?.id` — same pattern as plot image hydration.
    },
    [updateScratchTour, currentName],
  );
  const setActiveRider = useCallback(
    (id: ID) => {
      updateScratchTour((t) => {
        const idx = t.riderImports.findIndex((r) => r.id === id);
        if (idx <= 0) return t; // already active or not found
        const reordered = [...t.riderImports];
        const [moved] = reordered.splice(idx, 1);
        reordered.unshift(moved);
        return { ...t, riderImports: reordered };
      });
    },
    [updateScratchTour],
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
          const costKey = `${pf.airline}::${pf.flightNumber}::${departDate}`;
          const cost = FLIGHT_COST_BY_LEG[costKey];
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
            costPerPassenger: cost?.costPerPassenger,
            currency: cost?.currency,
            sourceFilename: imp.filename,
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
    (hotels: Hotel[], tasks: Task[], filename?: string) => {
      updateScratchTour((t) => {
        const hotelIds = new Set(hotels.map((h) => h.id));
        const taskIds = new Set(tasks.map((tk) => tk.id));
        return {
          ...t,
          hotels: [...t.hotels.filter((h) => !hotelIds.has(h.id)), ...hotels],
          tasks: [...t.tasks.filter((tk) => !taskIds.has(tk.id)), ...tasks],
          hotelImportHistory: [
            ...(t.hotelImportHistory ?? []),
            ...(t.hotelImport ? [t.hotelImport] : []),
          ],
          hotelImport: {
            at: getNowIso(),
            by: currentName,
            updates: (t.hotelImport?.updates ?? 0) + (t.hotelImport ? 1 : 0),
            filename: filename ?? t.hotelImport?.filename,
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
      void backend.deletePdf('rider', id);
      // Clear gear items seeded from this rider so re-import gets a fresh list.
      setGearItems([]);
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

        // Detect purely additive merge: all existing passengers survive with
        // the same seat. If so, patch Travel records directly — no re-approval.
        const isAdditiveOnly =
          wasImported &&
          existing.parsedFlights.every((pfExisting, idx) => {
            const pfMerged = merged[idx];
            if (!pfMerged) return false;
            return pfExisting.passengers.every((ep) =>
              pfMerged.passengers.some(
                (mp) =>
                  mp.name.trim().toLowerCase() === ep.name.trim().toLowerCase() &&
                  mp.seat === ep.seat,
              ),
            );
          });

        const mergedImport: FlightImport = {
          ...existing,
          parsedFlights: merged,
          unmatchedNames: merged.flatMap((pf) =>
            pf.passengers.filter((p) => !p.matchedTourPersonId).map((p) => p.name),
          ),
          uploadedAt: getNowIso(),
          uploadedBy: currentName,
          updates: (existing.updates ?? 0) + 1,
          status: isAdditiveOnly ? 'imported' : wasImported ? 'review' : existing.status,
        };

        // Additive-only: patch existing Travel records with newly matched passengers.
        // Non-additive: drop Travel so the user re-approves the updated data.
        let updatedTravel = t.travel;
        if (isAdditiveOnly) {
          updatedTravel = t.travel.map((tr) => {
            if (!tr.id.startsWith(`tr_${existing.id}_`)) return tr;
            const legIdx = parseInt(tr.id.split('_').slice(-1)[0] ?? '0', 10);
            const pfExisting = existing.parsedFlights[legIdx];
            const pfMerged = merged[legIdx];
            if (!pfExisting || !pfMerged) return tr;
            const newlyMatched = pfMerged.passengers.filter(
              (mp) =>
                mp.matchedTourPersonId &&
                !pfExisting.passengers.some(
                  (ep) => ep.matchedTourPersonId === mp.matchedTourPersonId,
                ),
            );
            if (newlyMatched.length === 0) return tr;
            return {
              ...tr,
              passengers: [
                ...tr.passengers,
                ...newlyMatched.map((p) => ({ tourPersonId: p.matchedTourPersonId!, seat: p.seat })),
              ],
            };
          });
        }

        return {
          ...t,
          flightImports: t.flightImports
            .filter((f) => f.id !== incomingId)
            .map((f) => (f.id === existingId ? mergedImport : f)),
          travel:
            wasImported && !isAdditiveOnly
              ? t.travel.filter((tr) => !tr.id.startsWith(`tr_${existing.id}_`))
              : updatedTravel,
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

  // Rewrite one leg's passengers and re-derive unmatchedNames against the
  // current roster. The transform runs inside the tour updater so it sees the
  // freshest state; any dropped names get their stored resolutions purged.
  const patchFlightImportLeg = useCallback(
    (
      importId: ID,
      legIndex: number,
      transform: (passengers: FlightImport['parsedFlights'][number]['passengers']) =>
        FlightImport['parsedFlights'][number]['passengers'],
    ) => {
      // Assigned (not pushed) inside the updater so a StrictMode double-invoke
      // produces the same final array instead of a duplicated one. The updater
      // must stay pure of its own externally-visible side effects.
      let droppedNames: string[] = [];
      updateScratchTour((t) => {
        const imp = t.flightImports.find((f) => f.id === importId);
        if (!imp) return t;
        const byName = new Map(
          t.personnel.map((p) => [p.person.name.trim().toLowerCase(), p.id]),
        );
        const localDropped: string[] = [];
        const nextFlights = imp.parsedFlights.map((pf, i) => {
          if (i !== legIndex) return pf;
          const transformed = transform(pf.passengers);
          // Re-run matching so a name fix flips the row from Unmatched → Matched.
          const rematched = transformed.map((p) => ({
            ...p,
            matchedTourPersonId: byName.get(p.name.trim().toLowerCase()),
          }));
          // Any prior name no longer in the leg has its resolution purged. The
          // *new* name in a rename also has its resolution cleared so an old
          // resolution from a different person doesn't haunt the renamed row.
          const newNames = new Set(rematched.map((p) => p.name.trim().toLowerCase()));
          const oldNames = new Set(pf.passengers.map((p) => p.name.trim().toLowerCase()));
          for (const prev of pf.passengers) {
            if (!newNames.has(prev.name.trim().toLowerCase())) localDropped.push(prev.name);
          }
          for (const next of rematched) {
            if (!oldNames.has(next.name.trim().toLowerCase())) localDropped.push(next.name);
          }
          return { ...pf, passengers: rematched };
        });
        droppedNames = localDropped;
        const unmatched = nextFlights.flatMap((pf) =>
          pf.passengers.filter((p) => !p.matchedTourPersonId).map((p) => p.name),
        );
        return {
          ...t,
          flightImports: t.flightImports.map((f) =>
            f.id === importId ? { ...f, parsedFlights: nextFlights, unmatchedNames: unmatched } : f,
          ),
        };
      });
      if (droppedNames.length) {
        setFlightPassengerResolutionsMap((prev) => {
          const next = new Map(prev);
          for (const n of droppedNames) next.delete(`${importId}::${n.trim().toLowerCase()}`);
          return next;
        });
      }
    },
    [updateScratchTour],
  );

  const editFlightImportPassenger = useCallback(
    (importId: ID, legIndex: number, passengerIndex: number, patch: { name?: string; seat?: string }) => {
      patchFlightImportLeg(importId, legIndex, (passengers) =>
        passengers.map((p, i) =>
          i === passengerIndex
            ? { ...p, name: patch.name ?? p.name, seat: patch.seat !== undefined ? patch.seat : p.seat }
            : p,
        ),
      );
    },
    [patchFlightImportLeg],
  );

  const removeFlightImportPassenger = useCallback(
    (importId: ID, legIndex: number, passengerIndex: number) => {
      patchFlightImportLeg(importId, legIndex, (passengers) =>
        passengers.filter((_, i) => i !== passengerIndex),
      );
    },
    [patchFlightImportLeg],
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
            resolvedAt: { at: getNowIso(), by: currentName },
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
            resolvedAt: { at: getNowIso(), by: currentName },
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
        next.set(dayId, { at: getNowIso(), by: currentName });
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
          stamp: { at: getNowIso(), by: currentName },
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
          resolvedAt: getNowIso(),
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
        next.set(key, { at: getNowIso(), by: currentName });
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
          resolvedAt: { at: getNowIso(), by: currentName },
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
        proposedAt: { at: getNowIso(), by: currentName },
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
          resolvedAt: { at: getNowIso(), by: currentName },
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
          resolvedAt: { at: getNowIso(), by: currentName },
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
          resolvedAt: { at: getNowIso(), by: currentName },
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
          proposedAt: { at: getNowIso(), by: currentName },
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
          resolvedAt: { at: getNowIso(), by: currentName },
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
          resolvedAt: { at: getNowIso(), by: currentName },
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

  // ---- Schedule-item content edits (direct tour mutation + history) -------
  const updateScheduleItem = useCallback(
    (itemId: ID, patch: ScheduleItemPatch) => {
      const item = tour.scheduleItems.find((i) => i.id === itemId);
      if (!item) return;
      const changes = computeScheduleItemChanges(item, patch);
      if (changes.length === 0) return;
      updateScratchTour((t) => ({
        ...t,
        scheduleItems: t.scheduleItems.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
      }));
      stampDay(item.dayId);
      setScheduleItemEditHistory((prev) => {
        const next = new Map(prev);
        const record: ScheduleItemEditRecord = {
          patch,
          changes,
          status: 'direct',
          resolvedAt: { at: getNowIso(), by: currentName },
        };
        next.set(itemId, [...(prev.get(itemId) ?? []), record]);
        return next;
      });
    },
    [tour.scheduleItems, updateScratchTour, stampDay, currentName],
  );

  const addScheduleItem = useCallback(
    (dayId: ID, init?: Partial<ScheduleItem>): ID => {
      const type = init?.type ?? 'other';
      const existingIds = new Set(tour.scheduleItems.map((i) => i.id));
      let n = tour.scheduleItems.length + 1;
      let id = `si_new_${n}`;
      while (existingIds.has(id)) id = `si_new_${++n}`;
      const newItem: ScheduleItem = {
        id,
        dayId,
        type,
        title: init?.title ?? scheduleItemLabel(type),
        startTime: init?.startTime ?? '12:00',
        endTime: init?.endTime,
        location: init?.location,
        notes: init?.notes,
        ownerPersonId: init?.ownerPersonId,
        visibility: init?.visibility ?? getScheduleTypeDefault(type),
        sensitive: init?.sensitive,
      };
      updateScratchTour((t) => ({ ...t, scheduleItems: [...t.scheduleItems, newItem] }));
      stampDay(dayId);
      setScheduleItemEditHistory((prev) => {
        const next = new Map(prev);
        const record: ScheduleItemEditRecord = {
          patch: { startTime: newItem.startTime, title: newItem.title, type },
          changes: [{ rowLabel: newItem.title, field: 'created', before: '', after: `${newItem.startTime} ${newItem.title}` }],
          status: 'created',
          resolvedAt: { at: getNowIso(), by: currentName },
        };
        next.set(id, [record]);
        return next;
      });
      return id;
    },
    [tour.scheduleItems, getScheduleTypeDefault, updateScratchTour, stampDay, currentName],
  );

  const deleteScheduleItem = useCallback(
    (itemId: ID) => {
      const item = tour.scheduleItems.find((i) => i.id === itemId);
      if (!item) return;
      updateScratchTour((t) => ({
        ...t,
        scheduleItems: t.scheduleItems.filter((i) => i.id !== itemId),
      }));
      stampDay(item.dayId);
      // Drop any visibility overlay / pending proposal for the dead item.
      setVisibilityEdits((prev) => {
        if (!prev.has(itemId)) return prev;
        const next = new Map(prev);
        next.delete(itemId);
        return next;
      });
      setPendingVisibilityEdits((prev) => {
        if (!prev.has(itemId)) return prev;
        const next = new Map(prev);
        next.delete(itemId);
        return next;
      });
      setScheduleItemEditHistory((prev) => {
        const next = new Map(prev);
        const record: ScheduleItemEditRecord = {
          patch: {},
          changes: [{ rowLabel: item.title, field: 'deleted', before: `${item.startTime} ${item.title}`, after: '' }],
          status: 'deleted',
          resolvedAt: { at: getNowIso(), by: currentName },
        };
        next.set(itemId, [...(prev.get(itemId) ?? []), record]);
        return next;
      });
    },
    [tour.scheduleItems, updateScratchTour, stampDay, currentName],
  );

  const getScheduleItemHistory = useCallback(
    (itemId: ID): ScheduleItemEditRecord[] => scheduleItemEditHistory.get(itemId) ?? [],
    [scheduleItemEditHistory],
  );

  // ---- Personnel + groups (direct tour mutation) --------------------------
  const addTourPerson = useCallback(
    (init: TourPersonInit): ID => {
      const used = new Set(tour.personnel.flatMap((p) => [p.id, p.personId]));
      const base = `manual_${init.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
      let slug = base;
      let n = 2;
      while (used.has(`tp_${slug}`) || used.has(`p_${slug}`)) slug = `${base}_${n++}`;
      const tpId = `tp_${slug}`;
      const pId = `p_${slug}`;
      const newPerson: TourPerson = {
        id: tpId,
        personId: pId,
        person: { id: pId, name: init.name },
        role: init.role,
        groupId: init.groupId,
        tagIds: init.tagIds ?? [],
        startDate: init.startDate ?? tour.startDate,
        endDate: init.endDate ?? tour.endDate,
        isPlaceholder: false,
      };
      updateScratchTour((t) => ({ ...t, personnel: [...t.personnel, newPerson] }));
      return tpId;
    },
    [tour.personnel, tour.startDate, tour.endDate, updateScratchTour],
  );

  const removeTourPerson = useCallback(
    (id: ID) => {
      updateScratchTour((t) => ({ ...t, personnel: t.personnel.filter((tp) => tp.id !== id) }));
    },
    [updateScratchTour],
  );

  const updateTourPerson = useCallback(
    (id: ID, patch: TourPersonPatch) => {
      updateScratchTour((t) => ({
        ...t,
        personnel: t.personnel.map((tp) =>
          tp.id === id
            ? {
                ...tp,
                role: patch.role ?? tp.role,
                groupId: patch.groupId ?? tp.groupId,
                tagIds: patch.tagIds ?? tp.tagIds,
                startDate: patch.startDate ?? tp.startDate,
                endDate: patch.endDate ?? tp.endDate,
                person:
                  patch.name !== undefined
                    ? { ...tp.person, name: patch.name }
                    : tp.person,
              }
            : tp,
        ),
      }));
    },
    [updateScratchTour],
  );

  // ---- Gear & supplies mutations ------------------------------------------
  const updateGearItem = useCallback(
    (itemId: ID, patch: Partial<Omit<GearItem, 'id'>>) => {
      setGearItems((prev) => prev.map((g) => (g.id === itemId ? { ...g, ...patch } : g)));
    },
    [],
  );

  const addGearItem = useCallback(
    (init: Omit<GearItem, 'id'>): ID => {
      let id!: ID;
      setGearItems((prev) => {
        // Use the current list length as a monotonic offset — unique within session.
        id = `gear_manual_${prev.length + 1}`;
        return [...prev, { ...init, id }];
      });
      return id;
    },
    [],
  );

  const deleteGearItem = useCallback(
    (itemId: ID) => {
      setGearItems((prev) => prev.filter((g) => g.id !== itemId));
    },
    [],
  );

  // ---- Document submissions (Milestone 2) ---------------------------------
  // On `local`: the overlay array is the source of truth; file bytes go to the
  // IndexedDB documents store via savePdf('submissions', id). On `supabase`:
  // the backend RPC + submissions table + tour-pdfs storage, refreshed into the
  // `submissions` cache. Everything is gated on `isSupabase` so local behaves
  // identically to before (the array just stays empty until something is added).
  const refreshSubmissions = useCallback(async () => {
    if (!isSupabase) return;
    try {
      const rows = await backend.listSubmissions?.(tour.id);
      if (rows) setSubmissions(rows);
    } catch {
      /* non-fatal — keep the last cache */
    }
  }, [isSupabase, tour.id]);

  const proposeSubmission = useCallback(
    async (
      init: { type: SubmissionType; title: string; description?: string },
      file?: File,
    ): Promise<DocumentSubmission | null> => {
      if (isSupabase) {
        const created = await backend.proposeSubmission?.({
          tourId: tour.id,
          type: init.type,
          title: init.title,
          description: init.description,
          filename: file?.name,
        });
        if (created && file) {
          // Path segment {uid}/{id} → {tourId}/submissions/{uid}/{id}.pdf.
          const seg = `${created.uid}/${created.id}`;
          await backend.savePdf('submissions', seg, await file.arrayBuffer());
        }
        if (created) setSubmissions((prev) => [created, ...prev]);
        return created ?? null;
      }
      // Local: synthesize the row and store bytes keyed by id.
      const id = `sub_local_${Date.now()}`;
      if (file) await backend.savePdf('submissions', id, await file.arrayBuffer());
      const sub: DocumentSubmission = {
        id,
        tourId: tour.id,
        uid: membership?.uid ?? 'local-user',
        email: membership?.email ?? '',
        displayName: currentName,
        type: init.type,
        title: init.title,
        description: init.description ?? '',
        status: 'pending',
        filename: file?.name,
        storagePath: file ? id : undefined,
        submittedAt: getNowIso(),
      };
      setSubmissions((prev) => [sub, ...prev]);
      return sub;
    },
    [isSupabase, tour.id, membership, currentName],
  );

  const approveSubmission = useCallback(
    async (id: ID, note?: string) => {
      if (isSupabase) {
        await backend.approveSubmission?.(id, currentName, note);
        await refreshSubmissions();
        return;
      }
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: 'approved', reviewedAt: getNowIso(), reviewedBy: currentName, reviewNote: note }
            : s,
        ),
      );
    },
    [isSupabase, currentName, refreshSubmissions],
  );

  const rejectSubmission = useCallback(
    async (id: ID, reason: string) => {
      if (isSupabase) {
        await backend.rejectSubmission?.(id, currentName, reason);
        await refreshSubmissions();
        return;
      }
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: 'rejected', reviewedAt: getNowIso(), reviewedBy: currentName, reviewNote: reason }
            : s,
        ),
      );
    },
    [isSupabase, currentName, refreshSubmissions],
  );

  const loadSubmissionFileUrl = useCallback(
    async (sub: DocumentSubmission): Promise<string | null> => {
      if (!sub.storagePath && !sub.filename) return null;
      // Local stores bytes keyed by the submission id; supabase under {uid}/{id}.
      const key = isSupabase ? `${sub.uid}/${sub.id}` : sub.id;
      const bytes = await backend.loadPdf('submissions', key);
      if (!bytes) return null;
      const type = sub.filename?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';
      return URL.createObjectURL(new Blob([bytes], { type }));
    },
    [isSupabase],
  );

  const addDocument = useCallback(
    (init: { kind: DocumentKind; title: string; liveLink: string }): ID => {
      const id = `doc_${Date.now()}`;
      updateScratchTour((t) => ({
        ...t,
        documents: [
          ...t.documents,
          {
            id,
            kind: init.kind,
            title: init.title,
            liveLink: init.liveLink,
            currentRevision: 1,
            revisions: [
              {
                id: `${id}_r1`,
                revision: 1,
                uploadedAt: getNowIso(),
                uploadedBy: currentName,
                sourceUrl: init.liveLink,
              },
            ],
            visibility: vis.everyone('sees'),
          },
        ],
      }));
      return id;
    },
    [updateScratchTour, currentName],
  );

  // ---- Travel / Hotel cost edits ------------------------------------------
  // Inline edits from the Supplies & Costs page. Mutate the tour directly
  // (rebuild + persist), the same shape as updateScheduleItem — every read
  // site sees the change without an overlay layer.
  const updateHotelCost = useCallback(
    (hotelId: ID, patch: Partial<Pick<Hotel, 'nightlyRate' | 'currency' | 'taxRate'>>) => {
      updateScratchTour((t) => ({
        ...t,
        hotels: t.hotels.map((h) => (h.id === hotelId ? { ...h, ...patch } : h)),
      }));
    },
    [updateScratchTour],
  );

  const updateTravelCost = useCallback(
    (travelId: ID, patch: Partial<Pick<Travel, 'costPerPassenger' | 'currency'>>) => {
      updateScratchTour((t) => ({
        ...t,
        travel: t.travel.map((tr) => (tr.id === travelId ? { ...tr, ...patch } : tr)),
      }));
    },
    [updateScratchTour],
  );

  const addGroup = useCallback(
    (name: string, color: string): ID => {
      const used = new Set(tour.groups.map((g) => g.id));
      const base = `grp_manual_${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
      let id = base;
      let n = 2;
      while (used.has(id)) id = `${base}_${n++}`;
      const newGroup: Group = { id, name: name.trim(), color };
      updateScratchTour((t) => ({ ...t, groups: [...t.groups, newGroup] }));
      return id;
    },
    [tour.groups, updateScratchTour],
  );

  const getPendingConflictResolution = useCallback(
    (id: ID) => pendingConflictResolutions.get(id),
    [pendingConflictResolutions],
  );
  const proposeConflictResolution = useCallback(
    (id: ID, resolution: Omit<PendingConflictResolution, 'conflictId' | 'proposedAt'>) => {
      setPendingConflictResolutions((prev) => {
        const next = new Map(prev);
        next.set(id, { conflictId: id, ...resolution, proposedAt: { at: getNowIso(), by: currentName } });
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
      booting,
      user,
      userKey,
      setUserKey,
      allUsers,
      resetScratchTour,
      applyRouteToScratch,
      addRiderImportToScratch,
      setActiveRider,
      addFlightImportToScratch,
      commitFlightImportToScratch,
      addHotelImportToScratch,
      cancelRouteImport,
      cancelRiderImport,
      discardFlightImport,
      cancelHotelImport,
      replaceFlightImport,
      mergeFlightImport,
      editFlightImportPassenger,
      removeFlightImportPassenger,
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
      updateScheduleItem,
      addScheduleItem,
      deleteScheduleItem,
      getScheduleItemHistory,
      addTourPerson,
      removeTourPerson,
      updateTourPerson,
      addGroup,
      gearItems,
      updateGearItem,
      addGearItem,
      deleteGearItem,
      updateHotelCost,
      updateTravelCost,
      submissions,
      refreshSubmissions,
      proposeSubmission,
      approveSubmission,
      rejectSubmission,
      loadSubmissionFileUrl,
      addDocument,
    }),
    [tour, booting, user, userKey, allUsers, resetScratchTour, applyRouteToScratch, addRiderImportToScratch, setActiveRider, addFlightImportToScratch, commitFlightImportToScratch, editFlightImportPassenger, removeFlightImportPassenger, addHotelImportToScratch, getDay, getDayById, getScheduleItemsForDay, getTravelForDay, getHotelsForDay, getTasksForDay, getTourPersonById, getGroupById, getGroupTagById, getAllConflicts, lockedDays, isDayLocked, toggleDayLocked, setDayLocked, dayLockHistory, getDayLockHistory, getDayLastUpdated, resolvedConflicts, resolveConflict, unresolveConflict, isSectionApproved, getSectionApproval, approveSection, reopenSection, getSectionEdit, updateSectionEdit, getPendingEdit, proposeSectionEdit, approvePendingEdit, rejectPendingEdit, getSectionHistory, pendingConflictResolutions, getPendingConflictResolution, proposeConflictResolution, approvePendingConflictResolution, rejectPendingConflictResolution, visibilityEdits, getVisibilityEdit, updateVisibilityEdit, pendingVisibilityEdits, getPendingVisibilityEdit, proposeVisibilityEdit, approvePendingVisibilityEdit, rejectPendingVisibilityEdit, getVisibilityHistory, updateScheduleItem, addScheduleItem, deleteScheduleItem, getScheduleItemHistory, addTourPerson, updateTourPerson, addGroup, gearItems, updateGearItem, addGearItem, deleteGearItem, updateHotelCost, updateTravelCost, submissions, refreshSubmissions, proposeSubmission, approveSubmission, rejectSubmission, loadSubmissionFileUrl, addDocument],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}
