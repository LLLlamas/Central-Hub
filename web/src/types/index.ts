// Domain types for the tour-ops central hub.
// Mirrors the data model in potential-implementation.md (sec. 2),
// extended with rider-section payloads from handoff-post-pdf-interpret.md.
// Visibility is ABAC, not RBAC — see Visibility type below.

// ============================================================
// Primitives
// ============================================================

export type ID = string;
export type ISODate = string;      // YYYY-MM-DD
export type ISODateTime = string;  // YYYY-MM-DDTHH:mm
export type HHMM = string;         // 24h, e.g. "16:00"

// ============================================================
// Audit — who last touched a record, and when
// In production this is the row's `updated_at` / `updated_by`
// audit columns; surfaced in the UI so readers can trust freshness.
// ============================================================

export interface UpdateStamp {
  at: ISODateTime;   // when the record was last updated
  by: string;        // display name of the person who updated it
  /** How many times this record has been updated since first creation.
   *  Used by import audit lines to switch the label from "Imported" → "Updated". */
  updates?: number;
}

// One entry in a day's lock/unlock history — captures the reason and who/when.
export interface DayLockRecord {
  locked: boolean;
  reason?: string;
  stamp: UpdateStamp;
}

// A single field that changed in a section edit — used in history modal.
export interface FieldChange {
  rowLabel: string;   // e.g. "Ch 3 — Kick Drum", "Mix 1-2 — MAIN ELSA"
  field: string;      // human-readable field name
  before: string;
  after: string;
}

// ============================================================
// Visibility — attribute-based access control
// Hierarchy: persons > tags > groups > default. Most specific wins.
// Levels: blocked < sees < owns. Owns implies sees.
// ============================================================

export type VisibilityLevel = 'blocked' | 'sees' | 'owns';

export interface Visibility {
  default: VisibilityLevel;
  groups?: Record<ID, VisibilityLevel>;
  tags?: Record<ID, VisibilityLevel>;
  persons?: Record<ID, VisibilityLevel>;
}

// ============================================================
// Top-level entities
// ============================================================

export interface Organization {
  id: ID;
  name: string;
}

export type TourStatus = 'announced' | 'on_sale' | 'in_progress' | 'wrapped';

export interface Tour {
  id: ID;
  organizationId: ID;
  name: string;
  artistName: string;
  status: TourStatus;
  startDate: ISODate;
  endDate: ISODate;
  legs: Leg[];
  groups: Group[];
  groupTags: GroupTag[];
  personnel: TourPerson[];
  days: Day[];
  scheduleItems: ScheduleItem[];
  travel: Travel[];
  hotels: Hotel[];
  tasks: Task[];
  documents: Document[];
  flightImports: FlightImport[];
  riderImports: RiderImport[];
  /** Audit stamps for the lightweight imports that don't have their own record. */
  routeImport?: UpdateStamp;
  hotelImport?: UpdateStamp;
  /** Tour-level visibility template — every new ScheduleItem inherits the
   *  blob for its type unless explicitly overridden on the item. See
   *  `lib/visibilityDefaults.ts`. Partial so the user can clear a type back
   *  to "no template" if they want raw per-item control. */
  visibilityDefaultsByType?: Partial<Record<ScheduleItemType, Visibility>>;
}

export interface Leg {
  id: ID;
  name: string;       // "North America Leg 1"
  startDate: ISODate;
  endDate: ISODate;
}

// ============================================================
// Days
// ============================================================

export type DayType =
  | 'show'
  | 'off'
  | 'travel'
  | 'rehearsal'
  | 'promo'
  | 'hold';

export interface Day {
  id: ID;
  date: ISODate;
  legId?: ID;
  dayType: DayType;
  city?: string;
  country?: string;
  venueId?: ID;
  notes?: string;
  weather?: { high: number; low: number; conditions: string };
  sunrise?: HHMM;
  sunset?: HHMM;
  published: boolean; // day sheet posted
  lastUpdated?: UpdateStamp;
}

// ============================================================
// Personnel
// ============================================================

export interface Person {
  id: ID;
  name: string;
  email?: string;
  phone?: string;
  emergencyContact?: string;
  passport?: { number: string; nationality: string; expires: ISODate };
}

export interface Group {
  id: ID;
  name: string;        // "Audio", "Lighting", "Artist", "A Party", "Mgmt"
  color: string;       // hex
  description?: string;
}

export interface GroupTag {
  id: ID;
  groupId: ID;
  name: string;        // "FOH", "Monitors", "RF" inside Audio
}

export interface TourPerson {
  id: ID;
  personId: ID;
  person: Person;      // denormalized for easy rendering
  role: string;        // "FOH Engineer"
  groupId: ID;
  tagIds: ID[];
  startDate: ISODate;
  endDate: ISODate;
  /** True if this name is a role placeholder, not a real person. */
  isPlaceholder?: boolean;
}

// ============================================================
// Schedule, travel, hotels, tasks
// ============================================================

export type ScheduleItemType =
  | 'load_in'
  | 'soundcheck'
  | 'doors'
  | 'set'
  | 'changeover'
  | 'curfew'
  | 'load_out'
  | 'bus_call'
  | 'lobby_call'
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'press'
  | 'meet_greet'
  | 'rehearsal'
  | 'other';

export interface ScheduleItem {
  id: ID;
  dayId: ID;
  type: ScheduleItemType;
  title: string;
  startTime: HHMM;
  endTime?: HHMM;
  location?: string;
  notes?: string;
  ownerPersonId?: ID;
  visibility: Visibility;
  sensitive?: boolean;
}

export type TravelMode = 'flight' | 'drive' | 'bus' | 'train' | 'ferry';

export interface Travel {
  id: ID;
  dayId: ID;
  mode: TravelMode;
  carrier?: string;        // airline / bus company
  identifier?: string;     // flight number / bus number
  from: string;            // IATA or city
  to: string;
  departTime: HHMM;
  arriveTime: HHMM;
  recordLocator?: string;
  passengers: { tourPersonId: ID; seat?: string }[];
  visibility: Visibility;
}

export interface Hotel {
  id: ID;
  dayId: ID;
  name: string;
  address: string;
  phone?: string;
  checkIn?: HHMM;
  checkOut?: HHMM;
  nights?: number;
  occupants: { tourPersonId: ID; roomNumber?: string; roomType?: string }[];
  visibility: Visibility;
  sensitive: boolean;
}

export interface Task {
  id: ID;
  dayId?: ID;
  title: string;
  ownerTourPersonId?: ID;
  due?: ISODateTime;
  status: 'todo' | 'doing' | 'done';
  visibility: Visibility;
}

// ============================================================
// Documents — with revisions
// ============================================================

export type DocumentKind =
  | 'rider'
  | 'stage_plot'
  | 'input_list'
  | 'advance'
  | 'pass_sheet'
  | 'settlement'
  | 'other';

export interface DocumentRevision {
  id: ID;
  revision: number;
  uploadedAt: ISODateTime;
  uploadedBy: string;
  sourceUrl: string;
  sourceLanguage?: string;
  pageCount?: number;
  notes?: string;
}

export interface Document {
  id: ID;
  kind: DocumentKind;
  title: string;
  showId?: ID;
  liveLink: string;
  currentRevision: number;
  revisions: DocumentRevision[];
  visibility: Visibility;
}

// ============================================================
// AI Ingest — Flights
// ============================================================

export interface ParsedFlight {
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: ISODateTime;
  arrivalTime: ISODateTime;
  recordLocator?: string;
  passengers: { name: string; seat?: string; matchedTourPersonId?: ID }[];
}

export type IngestStatus = 'queued' | 'parsing' | 'review' | 'imported' | 'failed';

export interface FlightImport {
  id: ID;
  filename: string;
  uploadedAt: ISODateTime;
  uploadedBy?: string;
  status: IngestStatus;
  parsedFlights: ParsedFlight[];
  unmatchedNames: string[];
  /** Number of times this import has been replaced/merged after first upload.
   *  Drives the "Imported" → "Updated" label flip on the review surface. */
  updates?: number;
}

/**
 * How an unmatched flight passenger gets linked at approve-time:
 *   - 'assign' → use an existing roster TourPerson (by id)
 *   - 'add'    → create a new placeholder TourPerson and link to it
 *   - 'skip'   → keep them off the Travel record (the legacy behavior)
 * Keyed by `${importId}::${passengerName.toLowerCase()}` in AppState.
 */
export interface FlightPassengerResolution {
  action: 'assign' | 'add' | 'skip';
  tourPersonId?: ID;
}

// ============================================================
// AI Ingest — Riders
// Canonical section types from handoff-post-pdf-interpret.md §1.
// ============================================================

export type RiderSectionType =
  | 'cover_and_contacts'
  | 'production_control'
  | 'permits'
  | 'stage_specs'
  | 'audio_pa'
  | 'audio_monitors'
  | 'input_list'
  | 'output_patch'
  | 'stage_plot'
  | 'lighting_equipment'
  | 'lighting_plot'
  | 'backline'
  | 'video'
  | 'soundcheck'
  | 'ground_transport'
  | 'air_transport'
  | 'lodging'
  | 'dressing_rooms'
  | 'catering'
  | 'settlement'
  | 'other';

export type RiderSectionStatus = 'pending' | 'extracted' | 'review' | 'approved';

export interface ExtractionFlag {
  level: 'warning' | 'error';
  message: string;
}

// --- Input list channel (rider §6) -------------------------
export type StandType =
  | 'boom'
  | 'short_boom'
  | 'tall_boom'
  | 'mini_boom'
  | 'straight'
  | 'clamp'
  | 'none'
  | 'other';

export interface InputChannel {
  channelNumber: number;
  source: string;            // verbatim from rider
  sourceEn?: string;         // English translation if source != English
  micOrDi: string;           // verbatim, never translate model numbers
  standType?: StandType;
  standNotes?: string;
  phantom48v?: boolean;
  insertOutboard?: string;
  subSnake?: string;
  wireless?: boolean;
  wirelessSystem?: string;
  notes?: string;
  extractionFlags?: ExtractionFlag[];
  lastEditedAt?: UpdateStamp;
}

// --- Monitor mix (rider §6) --------------------------------
export type MonitorType =
  | 'in_ear_stereo'
  | 'in_ear_mono'
  | 'wedge'
  | 'side_fill'
  | 'drum_fill'
  | 'other';

export interface MonitorMix {
  outputs: string;           // "1-2", "3 & 4"
  mixName: string;           // "MAIN - ELSA"
  personName?: string;       // parsed from mix name
  type: MonitorType;
  bodypackCount?: number;
  notes?: string;
  lastEditedAt?: UpdateStamp;
}

// --- FOH outputs (rider §6) --------------------------------
export interface FOHOutput {
  outputNumber: string;
  source: string;
  notes?: string;
  lastEditedAt?: UpdateStamp;
}

// --- Backline (rider §9) -----------------------------------
export interface BacklinePiece {
  type: string;
  size: string;
  notes?: string;
}
export interface BacklineHardware {
  item: string;
  qty: number;
  preferred?: string[];
  excluded?: string[];       // CRITICAL: "no Yamaha", "no motorcycle seat"
  notes?: string;
}
export interface BacklineBassOption {
  optionNumber: number;
  head: string;
  cab: string;
}
export interface BacklineSpec {
  drums?: {
    kitOptions: string[];
    pieces: BacklinePiece[];
    hardware: BacklineHardware[];
  };
  bass?: { options: BacklineBassOption[] };
  guitar?: { item: string; qty: number; notes?: string }[];
  miscellaneous?: { item: string; qty: number; brandPreferred?: string; notes?: string }[];
  risersRequired?: boolean;
  videoScreen?: {
    type: string;
    dimensions: string;
    aspectRatio: string;
    resolutionPreferred: string;
    resolutionMin: string;
  };
}

// --- Lodging (rider §12) -----------------------------------
export type RoomType = 'single' | 'double' | 'junior_suite' | 'suite' | 'twin';
export interface RoomingEntry {
  roomNumber: number;
  roomType: RoomType;
  occupants: { name?: string; role: string }[];
}
export interface LodgingSpec {
  hotelRequirements?: {
    starRating?: number;
    chainOnly?: boolean;
    amenitiesRequired?: string[];
    artistPreApproval?: boolean;
  };
  roomingList: RoomingEntry[];
  totalRooms?: number;
  totalOccupants?: number;
}

// --- Catering (rider §14) ----------------------------------
export type MenuTime = 'load_in' | 'soundcheck' | 'show' | 'post_show';
export interface CateringItem {
  item: string;
  itemEn?: string;
  qty: number | string;
  unit?: string;
  brandPreferred?: string[];
  brandExcluded?: string[];
  notes?: string;
  dietaryTags?: string[];
}
export interface CateringMenu {
  room: string;
  menuTime: MenuTime;
  availableBy?: string;
  items: CateringItem[];
}
export interface CateringSpec {
  menus: CateringMenu[];
  generalRequirements?: {
    biodegradableDisposables?: boolean;
    foodDonationPlanRequired?: boolean;
    other?: string[];
  };
}

// --- Conflicts (derived after extraction) ------------------
export type ConflictType =
  | 'numeric_disagreement'
  | 'missing_reference'
  | 'count_mismatch'
  | 'duplicate'
  | 'other';
export interface Conflict {
  id: ID;
  type: ConflictType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  sectionsInvolved: string[];
  values: { section: string; value: string }[];
  suggestedResolution?: string;
}

// --- Section payload (one of, by type) ---------------------
export interface RiderSection {
  type: RiderSectionType;
  pages: number[];
  status: RiderSectionStatus;
  confidence?: number;
  language?: string;
  // payloads — one of, depending on section type
  inputList?: InputChannel[];
  monitorMix?: MonitorMix[];
  fohOutputs?: FOHOutput[];
  backline?: BacklineSpec;
  lodging?: LodgingSpec;
  catering?: CateringSpec;
  conflicts?: Conflict[];
  // free-text fallback for sections without dedicated structure
  freeText?: string;
  freeTextEn?: string;
}

export interface RiderImport {
  id: ID;
  filename: string;
  uploadedAt: ISODateTime;
  uploadedBy: string;
  sourceLanguage: string;
  pageCount: number;
  status: IngestStatus;
  artistName?: string;
  revisionInfo?: { version?: string; date?: string; warning?: string };
  productionManager?: { name?: string; email?: string; phone?: string };
  partySize?: { tourists?: number; rooms?: number; flightTickets?: number };
  sections: RiderSection[];
  revisionOf?: ID;
  revision: number;
}

// Inline corrections layered over AI extraction for a single section.
export interface RiderSectionEdit {
  inputList?: InputChannel[];
  monitorMix?: MonitorMix[];
  fohOutputs?: FOHOutput[];
  freeText?: string;
  freeTextEn?: string;
}

// Archived record of a completed edit event (approved / rejected / direct manager edit).
export interface SectionEditRecord {
  patch: RiderSectionEdit;
  changes: FieldChange[];
  proposedAt?: UpdateStamp;   // undefined for direct manager edits
  status: 'approved' | 'rejected' | 'direct';
  resolvedAt: UpdateStamp;
}

// A visibility change proposed by a non-manager, awaiting manager approval.
export interface PendingVisibilityEdit {
  itemId: ID;
  patch: Visibility;
  before: Visibility;
  proposedAt: UpdateStamp;
}

// Archived record of a completed visibility edit (approved / rejected / direct manager edit).
export interface VisibilityEditRecord {
  patch: Visibility;
  changes: FieldChange[];
  proposedAt?: UpdateStamp;   // undefined for direct manager edits
  status: 'approved' | 'rejected' | 'direct';
  resolvedAt: UpdateStamp;
}

// ============================================================
// View types
// ============================================================

export interface CurrentUser {
  tourPersonId: ID;
  name: string;
  role: string;
  groupId: ID;
  tagIds: ID[];
}
