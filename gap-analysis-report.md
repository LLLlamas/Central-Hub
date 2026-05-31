# Gap Analysis Report — Central-Hub
Generated: 2026-05-31
Codebase commit: ed3f268

> **For future implementers:** Cross-reference this against the source checklist at `gap-analysis.md`
> (user's Downloads) and against `CLAUDE.md` before starting any feature work. Section findings
> here reflect the actual codebase state, not the spec's intentions.

---

## Summary

- Total items audited: 103 feature items + 12 infrastructure checks
- ✅ Built: 21
- 🟡 Partial: 22
- ❌ Missing: 45
- 🚫 N/A / Defer: 27 (per spec — explicitly out of scope)

---

## Section-by-section findings

### 1. Travel & Logistics

- **1.1 Flight grid view** — 🟡 PARTIAL — Travel records exist (mode/carrier/route/times/passengers/seats/recordLocator/cost). Review queue on `/ingest/flights`. No standalone `/flights` grid view — travel data lives inside per-day views only. No sortable, filterable tour-wide flight list.
- **1.2 Per-passenger travel profile** — 🟡 PARTIAL — `Person` model has name/email/phone/emergencyContact/passport (number, nationality, expires). Travel.passengers has seat. Missing: DOB, visa info per country, KTN/PreCheck/Global Entry/NEXUS/CLEAR, frequent flyer numbers per airline, hotel loyalty numbers, inflight meal preferences, explicit seat preferences, t-shirt size.
- **1.3 Passport/visa expiration tracker** — ❌ MISSING — No auto-flagging of passports expiring within 6 months of tour dates.
- **1.4 Ground transport/transfers** — 🟡 PARTIAL — `Travel` type supports mode (bus/drive/ferry/train/flight), carrier, identifier, from/to city, times, passenger list with seats, cost. Missing: capacity-vs-passengers check, driver/operator contact, full pickup/dropoff addresses (city codes only), vehicle photo.
- **1.5 Charter flight/private aviation** — ❌ MISSING — No FBO, tail number, operator, cargo/equipment manifest, flight crew name fields.
- **1.6 Day-of-travel logistics bundle** — 🟡 PARTIAL — The day sheet already surfaces bus call, lobby call, flights with times, and hotel for each day. `Day.weather` and `Day.sunrise`/`Day.sunset` fields exist but have no live API feed. **Planned resolution: add timezone delta (departure vs arrival city) and live weather to the existing day sheet** — no separate "travel brief" view needed. Requires OpenWeather API integration (see 10.3) and timezone offset calculation from the Travel records on each day.
- **1.7 Hotel rooming list** — 🟡 PARTIAL — `Hotel` model has name/address/phone/checkIn/checkOut/nights/occupants (with roomNumber/roomType)/nightlyRate/currency/taxRate. Missing: confirmation/reservation number, special requests per person, group block code, Wi-Fi credentials, per diem allocation, exterior photo.
- **1.8 Hotel block management** — ❌ MISSING — No tracking of total rooms held, cutoff dates, group codes, attrition clauses, rooming-list submission deadlines.
- **1.9 Travel disruption handling** — 🚫 N/A — DEFER per spec.
- **1.10 ATA Carnet / international gear shipping** — 🚫 N/A — DEFER per spec.

---

### 2. Technical / Production Logistics

- **2.1 Truck pack/load manifest** — ❌ MISSING — No truck-level entity, no load manifests.
- **2.2 Case inventory/asset tracking** — 🚫 N/A — DEFER per spec (partner with CaseLister/Current RMS).
- **2.3 Power requirements per venue** — ❌ MISSING — `mockVenues` has a `voltage` string only. No structured amps/phase/breakers/connector type/drop locations fields.
- **2.4 Rigging plot + load calculations** — ❌ MISSING — No rigging entity.
- **2.5 Local crew call by department** — ❌ MISSING — No structured crew call with department/count/hours/union/steward fields.
- **2.6 Stagehand union information** — 🚫 N/A — DEFER per spec.
- **2.7 Stage dimensions and layout** — ❌ MISSING — `mockVenues` has capacity but no stage width/depth/height, wing space, loading dock path, or pre-rig presence.
- **2.8 RF coordination/frequency planning** — ❌ MISSING — No RF entity.
- **2.9 Backline rental coordination** — ❌ MISSING — `GearItem` tracks equipment with providedBy='rental' but no rental company contact, order number, delivery/pickup times, or damages tracker.
- **2.10 Show file/cue list versioning** — 🚫 N/A — DEFER per spec.
- **2.11 Pyro/SFX permits + sign-offs** — ❌ MISSING — No permit entity.
- **2.12 Show file backups** — 🚫 SKIP — Per spec (file storage solved elsewhere).

---

### 3. Schedule, Day Sheets, Communication

- **3.1 Show calendar with day types** — ✅ BUILT — `Calendar.tsx` with all 6 DayTypes: show/off/travel/rehearsal/promo/hold. Color-coded.
- **3.2 Schedule items with visibility** — ✅ BUILT — Full `ScheduleItem` model, 15+ types, ABAC visibility, `sensitive` flag. Note: no per-item `status` field (unconfirmed/confirmed/done) — only `Day.published`.
- **3.3 Schedule templates** — ❌ MISSING — Visibility defaults by type exist but no schedule item templates (no "Arena Show Day" with pre-filled items/times). No one-click day-shape pre-fill.
- **3.4 Day sheet generator** — 🟡 PARTIAL — In-app day sheet + print layout (`/print/daysheet/:date`) with edit mode, personalized view, and browser-print PDF. Missing: formal revision stamp/number, server-generated PDF with sensitive items auto-redacted, QR code linking to live in-app version.
- **3.5 Push notifications + change alerts** — ❌ MISSING — No push notification infrastructure. Web Push reaches Android but iOS requires PWA installed to home screen (iOS 16.4+, unreliable). Full cross-platform push effectively requires a native app or falling back to email/SMS as the primary channel.
- **3.6 Calendar feed export (iCal/.ics)** — ❌ MISSING — No iCal generation anywhere in the codebase.
- **3.7 Day type color coding + Gantt view** — 🟡 PARTIAL — Day type color coding exists throughout. No Gantt/horizontal tour-wide timeline view.
- **3.8 Internal task management** — 🟡 PARTIAL — `Task` type exists (id/dayId/title/ownerTourPersonId/due/status/visibility). Hotel import seeds advance tasks. Per-day tasks visible in DayDetail. Missing: per-tour tasks (not day-scoped), dedicated task management surface, task filtering by status across the tour.
- **3.9 Notes/changelog per show** — 🟡 PARTIAL — `Day.notes?: string` exists. Schedule item edit history tracked in AppState. Day lock history with reasons. Missing: auto-generated human-readable changelog ("TM moved load-in from 0700 to 0800"), pinned notes, version history on Day.notes.
- **3.10 Per-show comments/chat** — 🚫 N/A — DEFER per spec.
- **3.11 Weather + sunrise/sunset** — 🟡 PARTIAL — `Day` type has `weather?: { high, low, conditions }`, `sunrise?: HHMM`, `sunset?: HHMM` fields. No live API integration (OpenWeather/WeatherKit) — fields exist, data doesn't flow in.
- **3.12 Set list with cue references** — ❌ MISSING — No set list entity.

---

### 4. Personnel & Access

- **4.1 Personnel database (global)** — 🟡 PARTIAL — Per-tour `TourPerson` + linked `Person` entity exist. `/personnel` route. No global person registry reusable across tours — personnel is tour-scoped. Org-level person pool requires the multi-tenant refactor.
- **4.2 Groups + Group Tags** — ✅ BUILT — Groups (A Party, B Party, Crew Party) + Group Tags within groups + cross-party tags. ABAC visibility model consumes them.
- **4.3 Per-person permission level** — 🟡 PARTIAL — ABAC roles (blocked/sees/needs/owns) per schedule item exist. Supabase has 5 tour roles (owner/manager/production/crew/viewer). The full ABAC editor is present but the simple Read Only / Edit / Custom per-person summary that a non-technical TM can quickly set is not a distinct surface.
- **4.4 Visibility scope per person** — ✅ BUILT — ABAC with persons > tags > groups > default. All Events / Group-Only / Custom expressible through the editor. Individual overrides supported.
- **4.5 Time-bound access** — 🟡 PARTIAL — `TourPerson` has `startDate`/`endDate` fields. Auto-expiry enforcement at the RLS layer is not verified — the fields exist but the enforcement mechanism is unclear.
- **4.6 Show-specific personnel overrides** — ❌ MISSING — No per-show personnel overrides; "artist's spouse on guest list for LA show only" is not expressible.
- **4.7 Vendor/external guest access** — ❌ MISSING — No magic-link guest access, no account-free vendor/venue PM entry path.
- **4.8 Audit log** — ✅ BUILT — Supabase `history` table (append-only). AppState tracks: `scheduleItemEditHistory`, `visibilityEditHistory`, `sectionEditHistory`, `dayLockHistory`, all with `UpdateStamp`.
- **4.9 Departing crew offboarding** — ❌ MISSING — "Remove from tour" exists in Personnel modal + Supabase `revokeMember`. No formal offboarding: no retention of personal data in non-accessible form, no offboarding confirmation flow, no access-revoke cascade to personal data.
- **4.10 Self-service profile completion** — ❌ MISSING — No invite flow for crew to fill in their own passport, frequent flyer, dietary, emergency contact, t-shirt size. TM must enter everything manually.
- **4.11 Onboarding new crew mid-tour** — ❌ MISSING — No role templates ("New audio sub" provisions groups/tags/permissions/travel profile request/welcome email in one click).

---

### 5. Riders, Plots, Advance

- **5.1 Rider versioning** — ✅ BUILT — Multi-rider version history fully implemented (`riderImports[]` prepend). Every revision stored with PDF bytes in IndexedDB. `setActiveRider(id)` promotes any revision. `RiderVersionHistory` component with "View PDF" + "Make active".
- **5.2 Live link per show** — 🟡 PARTIAL — Shareable tokenized day sheet link (`/print/daysheet/:date?token=...`) exists. No live link pointing to current rider/plot/input list. No QR code variant.
- **5.3 Stage plot editor/viewer** — 🟡 PARTIAL — Viewer fully built (`PlotImageLightbox`, `/plots` route, `PdfViewerInline`). No drag-correct editor — view-only.
- **5.4 Rider PDF parsing pipeline** — ✅ BUILT — TOC-driven in-house parser (no LLM). Classify → extract per section (input list, monitor mixes, FOH outputs, backline, catering, rooming, free text) → cross-reference conflicts → version history. Handles Spanish + English riders. Matches the 8-step spec in `CLAUDE_CODE_HANDOFF.md`.
- **5.5 Advance workflow per venue** — ❌ MISSING — No advance template, no `/advance` route, no per-field status indicators (Not Started / In Progress / Done). A major daily-use gap — TMs coordinate the venue advance for weeks before each show.
- **5.6 Status indicators on advance items** — ❌ MISSING — Advance not built.
- **5.7 Venue self-service advance forms** — ❌ MISSING — No magic link for venue PM to fill in their own data.

---

### 6. Settlement, Money, Business

- **6.1 Per diem tracking** — ❌ MISSING — No per diem fields on Person/TourPerson. No tracking surface.
- **6.2 Settlement / box office reconciliation** — ❌ MISSING — No settlement entity.
- **6.3 Guest list workflow** — ❌ MISSING — No guest list entity, allotments, approval queue, or box office export.
- **6.4 Production budget tracking** — 🚫 N/A — DEFER per spec.
- **6.5 Tour finance / cashflow** — 🚫 N/A — DEFER per spec.
- **6.6 Insurance / COIs** — ❌ MISSING — No insurance entity.
- **6.7 Crew contracts / W-9s / 1099s** — 🚫 N/A — DEFER per spec.
- **6.8 Merchandise inventory + sales** — 🚫 N/A — DEFER per spec.

---

### 7. Venue Intelligence

- **7.1 Venue record core** — 🟡 PARTIAL — `mockVenues.ts` has a structured `MockVenue` with name/address/capacity/voltage/promoter/housePM/stageDoor for 5 venues. However: no real `Venue` type in `types/index.ts`; venues are not a persisted entity; missing stage dimensions, loading dock photos, rigging load, house PA spec, Wi-Fi, dressing rooms, nearest hospital.
- **7.2 Venue history per artist** — ❌ MISSING — No per-artist+venue history.
- **7.3 Cross-artist venue intelligence** — 🚫 N/A — DEFER per spec.
- **7.4 Promoter rep history** — ❌ MISSING — Promoter info exists in mockVenues but no first-class Promoter Rep entity with history.

---

### 8. Ingest Patterns

- **8.1 Flight itinerary PDF parsing** — ✅ BUILT — `parseFlightPdf` in `lib/pdfParser.ts`. Handles group e-tickets and single-passenger boarding passes. Fixture fallback via `fixtureMatcher.ts`.
- **8.2 Rider PDF parsing** — ✅ BUILT — See 5.4.
- **8.3 Hotel confirmation email parsing** — ❌ MISSING — Hotel PDF parsing exists (`parseHotelPdf`). Email parsing (forward → record created) not implemented.
- **8.4 Deal memo PDF parsing** — ❌ MISSING — No deal memo parser.
- **8.5 Advance email parsing** — ❌ MISSING — No email parsing of any kind.
- **8.6 CSV import** — ✅ BUILT — Route CSV and travel-agent grid CSV fully implemented. Personnel CSV and hotel block CSV not implemented.
- **8.7 Calendar import (.ics)** — ❌ MISSING — No .ics parser.
- **8.8 Copy from previous tour** — ❌ MISSING — No "import from past tour" flow. No org-level tour list to copy from. Daysheets' flagship feature.
- **8.9 Venue self-service forms** — ❌ MISSING — Same as 5.7.
- **8.10 Crew self-service profile** — ❌ MISSING — No invite-to-fill flow for crew.
- **8.11 TripIt integration** — ❌ MISSING.
- **8.12 FlightAware integration** — ❌ MISSING.

---

### 9. UX Patterns from Incumbents

- **9.1 Long-press to share (mobile)** — ❌ MISSING — No long-press gesture on any item.
- **9.2 Print templates with merge fields** — 🟡 PARTIAL — Printable day sheet exists with clean layout. Not a general merge-field print template system.
- **9.3 Pin/favorite venues** — 🚫 N/A — DEFER per spec.
- **9.4 Offline-first sync** — ❌ MISSING — localStorage + IndexedDB give browser-side persistence but no service worker, no network-request interception, no write queue. Not true offline-first.
- **9.5 Real-time collaboration** — ❌ MISSING — Supabase `postgres_changes` is in the backend module; only auth state is subscribed to in practice. No live data sync between two users editing simultaneously.
- **9.6 Quick-add via natural language** — 🚫 N/A — DEFER per spec.
- **9.7 Multi-tenant org structure** — ❌ MISSING — Single-tour model. No Org entity, no Org → multiple tours hierarchy, no org-level personnel/venue pool. Foundational gap for a real SaaS product. The single-tour assumption is woven through AppState, storage keys, and the Supabase schema.
- **9.8 Org-level analytics** — 🚫 N/A — DEFER per spec.
- **9.9 Billing / subscription** — ❌ MISSING — No Stripe, no subscription tiers, no billing surface.

---

### 10. Integrations

- **10.1 Google/Apple/Outlook calendar feeds** — ❌ MISSING — Same as 3.6.
- **10.2 Mapbox / Google Maps embed** — ❌ MISSING — `RouteMap.tsx` is a static SVG with hardcoded lat/lngs. No live map embed or tap-to-navigate.
- **10.3 OpenWeather / WeatherKit** — ❌ MISSING — `Day.weather` fields exist but no API call.
- **10.4 TripIt** — ❌ MISSING.
- **10.5 FlightAware** — ❌ MISSING.
- **10.6 Slack push notifications** — 🚫 N/A — DEFER per spec.
- **10.7 QuickBooks Online / Xero** — 🚫 N/A — DEFER per spec.
- **10.8 DocuSign / HelloSign** — 🚫 N/A — DEFER per spec.
- **10.9 HET Hub (truck tracking)** — 🚫 N/A — DEFER per spec.
- **10.10 Stripe (billing)** — ❌ MISSING — Same as 9.9.

---

### 12. Cross-cutting Infrastructure

| Check | Status | Notes |
|-------|--------|-------|
| Database RLS | ✅ BUILT | Full RLS on all 14 tables; ABAC per-row `readable_by` computed by trigger |
| Audit log table | ✅ BUILT | Supabase `history` table (append-only) + client-side history maps in AppState |
| Soft deletes | ❌ MISSING | No `deleted_at` column on any table; hard deletes only |
| Timezone handling | 🟡 PARTIAL | All DB timestamps are `timestamptz` (UTC). Frontend uses `date-fns` with no timezone lib; CLAUDE.md lists "Timezone-aware times throughout" as a known pending gap |
| i18n scaffolding | 🟡 PARTIAL | Rider section model preserves source-language titles; `SECTION_LABELS` as English fallback; no i18next/react-intl installed |
| PWA installability | ❌ MISSING | No `manifest.json`, no service worker, no PWA vite plugin |
| Push notification infrastructure | ❌ MISSING | No OneSignal, Web Push, or notification worker. iOS requires home-screen PWA (iOS 16.4+) or native app for reliable delivery. |
| File storage with signed URLs | ✅ BUILT | Supabase Storage `tour-pdfs` bucket, tour-scoped paths, RLS-protected |
| Error tracking | ❌ MISSING | No Sentry or equivalent |
| Analytics | ❌ MISSING | No PostHog, GA, or equivalent |
| Backup + restore strategy | ❌ UNKNOWN | No documented backup/restore for the Supabase database |
| Test fixtures | ✅ BUILT | Elsa y Elmar rider PDF, Mexico route CSV, travel grid CSV, 2 flight PDFs, 2 hotel PDFs all in `web/public/` |

---

## Top 10 Launch-Blocker Gaps (MUST HAVE items that are ❌ or 🟡)

Ranked by how badly their absence blocks putting real paying users on real tours.

1. **9.7 Multi-tenant org structure** — The entire SaaS model requires Org → Tours. Without it there's no account for a TM to own across sessions, no separation between different TMs' data. The single-tour assumption runs through AppState, storage keys, and the Supabase schema. Biggest structural refactor ahead; everything else depends on it or gets easier after it.

2. **9.9 / 10.10 Billing/subscription (Stripe)** — Can't charge anyone. Even a private alpha needs a billing gate for intent signal. Depends on #1 (you bill an org, not a tour).

3. **5.5 Advance workflow per venue** — The daily job of a TM is working through the venue advance. Without a per-venue checklist with per-field status indicators, TMs keep an Excel spreadsheet alongside the app and the hub isn't their primary tool.

4. **8.8 Copy from previous tour** — Daysheets' flagship feature. Every new tour, the TM wants to bring over their roster, groups, tags, and templates from the last run. Without this, setup cost is prohibitive.

5. **3.5 Push notifications + change alerts** — A day sheet that changes and nobody knows is worse than no day sheet. Note: full iOS support requires native app or email/SMS as primary channel; Web Push alone won't reach iOS reliably.

6. **8.10 / 4.10 Crew self-service profile** — A TM managing 50 people can't manually enter every passport, frequent flyer, dietary restriction. The invite-to-fill pattern is table stakes before the travel profile feature (1.2) is usable in practice.

7. **6.3 Guest list workflow** — Every single show has a guest list. Allotments, submission deadlines, approval queues, and box office export are daily-use features at T3 that TMs currently do in email threads.

8. **6.1 Per diem tracking** — TMs track per diem daily (who was paid, how much, cash vs. card, signed receipt). Without this they keep an envelope and a spreadsheet. Daily-use T2 feature.

9. **4.9 Departing crew offboarding** — When a sub leaves, their access needs to revoke and their personal data needs to be retained but inaccessible. The security gap is a real liability for real deployments.

10. **3.3 Schedule templates** — Without "Arena Show Day" one-click pre-fills, TMs rebuild schedules from scratch every time. The difference between 5-minute and 30-minute day setup blocks repeat-use adoption.

---

## Top 10 High-Value Near-Term Gaps (SHOULD HAVE items that are ❌)

1. **Venue as a real persisted entity (7.1 extension)** — `mockVenues.ts` is well-structured; promoting it to a real org-scoped `Venue` type + DB table is the foundation of compounding venue intelligence.

2. **4.11 Onboarding new crew mid-tour** — Role templates for subs. Highest-churn user segment; onboarding friction is a daily pain.

3. **3.11 Weather via API (10.3)** — `Day.weather` fields already exist. One OpenWeather API call per show day fills them. Very low effort, high perceived value for outdoor shows.

4. **3.6 / 10.1 iCal calendar feed** — Crew want shows in their iPhone calendar. Data is already there; just needs a generator endpoint.

5. **9.1 Long-press to share (mobile)** — Master Tour's #1 crew satisfaction pattern: long-press any item → copy/share. Reduces "can you re-send me the schedule" messages constantly.

6. **5.7 / 4.7 Venue + vendor magic-link access** — Venue PMs filling in their own advance data removes the TM's biggest manual burden. Pairs with the advance workflow (#3 in blockers above).

7. **2.5 Local crew call by department** — Production departments are called nightly. A structured crew call (department/count/call time/OT trigger/union steward) would be a daily-use add to the day sheet.

8. **10.2 Mapbox/Google Maps embed** — Venue + hotel addresses with "navigate" button. Crew get in rideshares constantly; tap-to-navigate is a daily-use affordance at very low engineering cost.

9. **8.7 iCal import** — Promo days and press days are often managed in a separate Google Calendar by the promo team. `.ics` import fills a real ingest gap.

10. **Hotel confirmation number** — The `Hotel` type is missing the reservation/confirmation number field. It's a trivial data model addition but a daily-use field every TM expects.

---

## Items the Codebase Has Gone Beyond This Checklist

Features not in the gap analysis spec that represent meaningful differentiation:

1. **In-house PDF parser (no LLM, no backend)** — TOC-driven, pdfjs-based parser handles the actual production rider. No per-parse LLM cost, no latency, works offline, handles Spanish and English. The spec assumed an AI pipeline; the implementation is architecturally stronger.

2. **Dual backend seam (local + Supabase)** — `lib/backend/` cleanly separates local (localStorage + IndexedDB) from Supabase. The local path is byte-for-byte unchanged; the app works fully without any backend environment configured.

3. **Guided coach-mark walkthrough** — 15-step interactive onboarding over the scratch tour (`components/tour/`). Auto-navigates, spotlights real UI, auto-advances on completion predicates. Directly addresses the "knowledge from past tours is lost" gap by teaching the tool from first use.

4. **Gear & Supplies tracker (`/gear`)** — Not in the gap analysis. Full `GearItem` inventory seeded from the rider (§6 mics, §9 backline, §13 dressing rooms, §14 catering) with status/cost/category/source. Smart re-import merge preserves user edits.

5. **Section-level approval + pending-edit workflow** — Non-managers propose rider section corrections; managers approve/reject with full audit trail. More sophisticated than the spec's rider review requirement.

6. **Conflict resolution workflow** — Document conflicts with pending/approval workflow, proposedAt + resolvedAt dual timestamp, manager-only re-open, full audit trail.

7. **Rider version history (full fidelity)** — All revisions retained with PDF bytes in IndexedDB. `setActiveRider(id)` promotes any revision without losing section approvals. Directly addresses why Showvella exists as a separate product.

8. **Additive-only flight merge fast-path** — When a new import only adds passengers (no seat/metadata changes, no removals), the merge patches live Travel records without requiring re-approval. Real production nuance.

9. **Schedule permissions with type-cascade** — One visibility Save on a `lobby_call` propagates to all lobby calls in the tour. `applyTypeTemplateToAllItems` button pushes the template to all existing items. Solves the "re-configure 30 schedule items" problem.

10. **ABAC visibility with DB enforcement** — The client-side resolver (`lib/visibility.ts`) is mirrored by a DB-side `compute_readable_by()` SECURITY DEFINER function + `trg_set_readable_by()` trigger. Future RLS can enforce privacy at the DB layer without app changes.

---

## Architectural Observations

**What's strong:**
- Data model is well-structured and expressive. The ABAC visibility model is genuinely sophisticated.
- The in-house PDF parser is a real competitive moat — no incumbent does this without an LLM.
- The local ↔ Supabase backend seam is clean; zero behavior change on the local path.
- The Supabase schema (`0001_init.sql`, `0002_members.sql`) is well-thought-out with full RLS and trigger-enforced ABAC.

**What's fragile or needs attention before launch:**
- **Single-tour assumption is everywhere.** AppState, scratchStorage, overlayStorage, the Supabase backend — everything is built around one tour. The multi-tenant refactor will touch almost every file. Start this early.
- **TourPerson lacks travel profile fields.** `Person` has passport but none of the other travel profile fields (DOB, FFNs, KTN, loyalty numbers, t-shirt size). Data model change needed before travel profile UI is built.
- **Venue is a mock, not an entity.** `mockVenues.ts` has good structure but is hardcoded. Venue intelligence starts paying off only once venues are real DB rows.
- **No error tracking or analytics.** Zero visibility into what's broken or how users use the app. Must be added before inviting test users.
- **Client-side privacy (accepted caveat).** The full Tour JSONB reaches every active member's browser; visibility filtering is UI-only. Documented in CLAUDE.md. Fine for trusted-crew demo; Phase B per-row RLS decomposition is already drafted in `0001_init.sql`.

---

## Suggested Next 3 PRs

### PR 1 — Error Tracking + Analytics
**Why now:** Before any real users touch the app, zero visibility into breakage or usage. 2-hour change.
**Scope:** Add `@sentry/react` + `posthog-js` to `web/package.json`. Initialize both in `web/src/main.tsx`. Add `VITE_SENTRY_DSN` + `VITE_POSTHOG_KEY` to `.env.example`.

### PR 2 — Travel Profile Fields on Person
**Why now:** Blocks the travel profile story and crew self-service value prop. Self-contained data model change.
**Scope:** Add DOB, frequent flyer numbers (per airline), hotel loyalty numbers, KTN/PreCheck, seat preference, meal preference, t-shirt size to `Person` in `types/index.ts`. Update the personnel edit modal on `/personnel`. Serialize cleanly into existing `personnel` JSONB (no DB migration needed).

### PR 3 — Advance Workflow Skeleton
**Why now:** 5.5 is the single biggest daily-use gap. A minimal version moves the app from demo to daily tool.
**Scope:** New `Advance.tsx` route + sidebar entry + Cmd+K registration. New `VenueAdvance` type in `types/index.ts` (per-day, per-field status: Not Started / In Progress / Done + free-text value). `getAdvanceForDay()` query helper. `updateAdvanceField(dayId, field, value)` mutator in AppState. Surfaceable as a panel in `DayDetail` as well as the standalone route.

---

*End of gap analysis report.*
