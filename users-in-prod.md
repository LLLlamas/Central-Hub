# Multi-User Production — Architecture Plan

> **For future agents:** Read this alongside `CLAUDE.md` (the working map of the current prototype). This doc covers what changes when the app grows from a single-browser demo into a real shared product. Don't touch production infrastructure without reading both.

---

## Where the app is today

Pure frontend. React + Vite + TypeScript + Tailwind v4 in `web/`. No server, no database, no real auth. All state lives in two `localStorage` keys:

- `tour-hub:scratch-tour` — the `Tour` object (days, schedule items, personnel, imports)
- `tour-hub:scratch-overlays` — every AppState overlay (visibility edits, locks, conflict resolutions, pending edits, flight passenger resolutions, etc.)

PDFs uploaded by the user are stored in **IndexedDB** as raw bytes (`lib/riderPdfStore.ts`) because Blob URLs are session-scoped. On boot, `AppStateProvider` re-derives the Blob URL from the stored bytes. This is a workaround for the no-backend constraint — it goes away when file storage exists.

Auth is a **role switcher** in the TopBar (Tour Manager / Manuel / Audio / Elsa / Julian / MUA). `AppState.userKey` is a plain string derived from the tour's own personnel. No passwords, no sessions, no tokens.

The app is designed for **one tour manager working alone** in their browser. A second person opening the same URL sees an empty tour.

---

## The good news: architecture is already multi-user shaped

The hard design work is done. The following are production-ready in concept — they just need a real backend to enforce them:

- **ABAC visibility model** (`lib/visibility.ts`) — `persons > tags > groups > default` resolver. Already correct. Currently runs client-side on unfiltered data; needs to move to the API layer so blocked users never receive the raw records.
- **Pending/approval workflow** — non-managers propose edits (section corrections, visibility changes, conflict resolutions); managers approve or reject. Stored in AppState Maps (`pendingEdits`, `pendingConflictResolutions`). The two-person audit trail (`proposedAt` + `resolvedAt/resolvedBy`) is already modelled on the types. Needs real-time notifications to be useful across browsers.
- **UpdateStamp audit trail** — every mutation stamps `MOCK_NOW` + current viewer. In production, `MOCK_NOW` becomes `new Date()` and the viewer is a real user ID.
- **Tour mutators as a clean API surface** — `applyRouteToScratch`, `addRiderImportToScratch`, `addFlightImportToScratch`, `commitFlightImportToScratch`, `addHotelImportToScratch`, etc. These are the write operations. They become API calls with no changes to the callers.

CLAUDE.md notes explicitly: *"When backend lands, replace with TanStack Query + Zustand or similar; the context shape is intentionally stable so callers don't have to change."*

---

## Recommended stack: Supabase

**Why Supabase specifically:**

| Need | Supabase feature |
|---|---|
| Auth (email/password, magic link, OAuth) | Supabase Auth |
| Tour + schedule data | PostgreSQL |
| File storage for rider PDFs, flight PDFs, CSVs | Supabase Storage (S3-compatible) |
| Real-time for pending/approval flows | Supabase Realtime (Postgres changes → websocket) |
| Server-side ABAC enforcement | Row-Level Security (RLS) policies |
| Fast to prototype, free tier | Yes |

The typed tour schema (`web/src/types/index.ts`) maps directly to PostgreSQL tables. RLS policies can enforce the visibility model at the database layer so the API never returns rows a user is blocked from reading.

---

## What changes, in order

### 1. Auth
**Replace the TopBar role-switcher with real accounts.**

- Each `TourPerson` gets a `supabase_user_id` column linking them to a Supabase Auth user.
- On signup/login, Supabase issues a JWT. The frontend sends it with every request.
- `AppState.userKey` becomes the authenticated user's ID from the session.
- `AppState.user` resolves from a DB query: `SELECT * FROM persons WHERE supabase_user_id = $uid`.
- The role-switcher (demo tool) is gated behind a dev flag or removed entirely in production.

Files to touch: `state/AppState.tsx` (swap `userKey` derivation), `components/layout/TopBar.tsx` (replace switcher with auth UI), `main.tsx` (wrap with Supabase session provider).

### 2. Server-side tour storage
**Move the two localStorage keys to the database.**

Core tables needed (derived from `web/src/types/index.ts`):

```
tours           — id, name, artist, created_by, created_at
days            — id, tour_id, date, type, venue_id, ...
schedule_items  — id, day_id, type, start_time, end_time, title, ...
persons         — id, tour_id, supabase_user_id, name, role, group_id, ...
groups          — id, tour_id, name, ...
rider_imports   — id, tour_id, uploaded_by, uploaded_at, ...
rider_sections  — id, import_id, type, title, freeText, ...
flight_imports  — id, tour_id, ...
flights         — id, import_id, ...
hotel_imports   — id, tour_id, ...
hotels          — id, import_id, day_id, ...
visibility_edits        — id, item_id, item_type, patch (jsonb), edited_by, edited_at
pending_edits           — id, item_id, item_type, patch (jsonb), proposed_by, proposed_at
resolved_conflicts      — id, conflict_id, chosen_value, resolved_by, resolved_at
```

`scratchStorage.ts` and `overlayStorage.ts` are replaced by Supabase client calls. The AppState mutators become thin wrappers: call the API, then update local React state (or let TanStack Query handle cache invalidation).

Files to touch: `lib/scratchStorage.ts`, `lib/overlayStorage.ts`, `state/AppState.tsx` (all mutators + query helpers).

### 3. PDF and file storage
**Replace IndexedDB with Supabase Storage.**

Currently: user uploads a PDF → `pdfParser.ts` parses it → raw bytes go to IndexedDB → Blob URL re-derived on boot.

In production:
- Upload the raw file to Supabase Storage bucket (`rider-pdfs/{tour_id}/{import_id}.pdf`).
- Store the storage path on the `rider_imports` row.
- Serve back to the client as a signed URL (time-limited, per-user).
- `lib/riderPdfStore.ts` (the IndexedDB layer) is deleted.
- The boot-time rehydration effect in `AppStateProvider` becomes a signed URL fetch.

Same pattern for flight confirmation PDFs and route CSVs.

Files to touch: `lib/riderPdfStore.ts` (delete), `state/AppState.tsx` (remove boot rehydration effect), `lib/pdfParser.ts` (accept URL instead of File object where needed).

### 4. Real-time sync
**Critical for the pending/approval UX.**

The pending/approval workflows (section edits, visibility proposals, conflict resolutions) are designed as async two-person flows. Without real-time, the tour manager has to manually refresh to see a crew member's proposal. With Supabase Realtime:

- Subscribe to `pending_edits` table changes filtered by `tour_id`.
- When a new row appears, AppState updates and the TM sees an amber dot immediately.
- Same for `pending_conflict_resolutions`.

This is a small addition on top of the database work — Supabase Realtime is a websocket subscription on a Postgres change feed. The existing pending/approval UI in `RiderIngest.tsx` and `ConflictFeed.tsx` needs no visual changes.

### 5. Server-side ABAC enforcement
**Required before shipping to real users.**

Currently `lib/visibility.ts` runs in the browser on the full unfiltered tour. A blocked user can open DevTools and read everything.

In production, RLS policies on the `schedule_items`, `rider_sections`, etc. tables check the authenticated user's `group_id` against the item's `visibility` column before returning rows. The client-side resolver in `lib/visibility.ts` stays as a UI-layer filter (for rendering), but it's no longer the security boundary.

---

## Multi-tour support

The current app is one tour per browser. In production, the sidebar gets a tour picker and users belong to one or more tours. The `AppState.tour` becomes the *selected* tour from a list. This is additive — no current code needs to change, just the boot flow and nav.

---

## Migration path for a future agent

Start here, in this order:

1. **Set up Supabase project** — create the tables above, enable Auth, create a Storage bucket.
2. **Install Supabase client** — `npm install @supabase/supabase-js` in `web/`.
3. **Wire auth** — replace the TopBar switcher with a real login/signup form. Gate the app behind a session check in `main.tsx`. This is self-contained and unblocks everything else.
4. **Migrate AppState reads** — replace `loadScratchTour()` + `loadScratchOverlays()` with a `useQuery` that fetches the tour from Supabase. The component tree doesn't change.
5. **Migrate AppState writes** — each mutator (`applyRouteToScratch`, etc.) gets a `supabase.from(...).upsert(...)` call. Persist to DB, then update local state.
6. **Migrate file uploads** — in the ingest dropzones (`FlightIngest.tsx`, `RiderIngest.tsx`, `HotelImportSection`), upload to Supabase Storage before (or alongside) parsing. Store the path on the import record.
7. **Add Realtime subscriptions** — subscribe to `pending_edits` and `pending_conflict_resolutions` in `AppStateProvider`. Merge incoming rows into the existing Maps.
8. **Add RLS policies** — once the data model is stable, write RLS policies that mirror `lib/visibility.ts`. Audit: compare client-side filter output vs DB output on the same tour.

**Do not attempt steps 4–8 before step 3.** Auth is the load-bearing foundation; without it, user IDs don't exist and the DB schema can't be wired correctly.

---

## Will users be able to install it on their phone?

**Yes, without an App Store.** This app can be shipped as a **Progressive Web App (PWA)**. Because it's a Vite app, adding PWA support takes about 30 minutes:

1. Install `vite-plugin-pwa` (`npm install -D vite-plugin-pwa`).
2. Add a `manifest.json` (app name, icons, theme color, `display: "standalone"`).
3. Register a service worker (the plugin generates one).

Once deployed to any HTTPS host (Vercel, Netlify, etc.):
- **iPhone:** Safari → Share → "Add to Home Screen" → installs as a full-screen app icon, no App Store.
- **Android:** Chrome shows an "Install app" banner automatically, or the user can do it from the browser menu.

With Supabase Auth wired, users open the installed app → see a login screen → sign up with email → land in their tour. The experience is indistinguishable from a native app for a non-technical user.

**Caveats:**
- PWAs on iOS have some limitations (no push notifications without a native wrapper, background sync is limited). For tour management — primarily a scheduling and reference tool — these don't matter.
- Offline support: the app shell loads offline, but tour data requires a connection. That's acceptable for now; a future offline-first pass with service-worker caching would change this.
- If the app ever needs native device features (camera for rider photos, biometric auth), a React Native wrapper (Expo) is the natural next step — but the web app comes first.

---

## Summary for a future agent

The prototype is feature-complete for a single user. The gaps are entirely infrastructure:

| Gap | Solution | Effort |
|---|---|---|
| Real auth | Supabase Auth | Low |
| Shared tour data | Supabase PostgreSQL + TanStack Query | Medium |
| File storage | Supabase Storage | Low |
| Real-time approval flows | Supabase Realtime | Low (once DB is up) |
| Server-side access control | Supabase RLS | Medium |
| Phone install | vite-plugin-pwa | Low |

No UI rebuilds required. The data model, visibility logic, and pending/approval workflows are already production-shaped. The work is plumbing, not design.
