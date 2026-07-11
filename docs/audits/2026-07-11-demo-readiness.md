# Demo-Readiness Audit — 2026-07-11

Pre-client-demo audit of the Start-From-Scratch experience. Three parallel audits
(data-consistency of every AppState mutator, live-demo edge cases, UX
simplicity/forgiveness/redundancy) plus an end-to-end browser run of the full
import walkthrough. **Every fix below is applied and verified**: 89/89 unit
tests pass, `tsc` clean, production build succeeds, and the route → rider →
flights → hotels flow was driven live in a browser after the fixes.

---

## Fixed in this pass

### Demo-blockers

1. **Viewer switcher was a one-way door.** Switching to any crew member (Elsa,
   Julian, …) disabled the switcher permanently — and the choice persisted
   across reloads, so the demo stayed locked as that person. The switcher's
   capability now comes from the signed-in membership (synthetic TM on local),
   not the previewed persona. `TopBar.tsx`. Verified live: TM → Elsa → TM.
2. **`data/mockTour.ts` was mojibake-corrupted** (UTF-8 BOM + double-encoded
   text on ~130 lines). "Manuel GonzÃ¡lez", "â€”", "Â§8" leaked into the visible
   roster, PM contact card, and conflict copy — and broke exact-match passenger
   matching for the PM in every flight/hotel import. Re-encoded (206 sequences
   repaired), BOM stripped.
3. **Hotel re-upload duplicated the hotel everywhere.** `parseHotelPdf` minted a
   `Date.now()` id per parse and AppState deduped by id only. Ids are now
   deterministic (`h_parsed_{name}_{checkInDay}`) and AppState additionally
   dedupes by `(name, check-in day)`, so re-uploading a corrected booking
   replaces instead of duplicating. Also: the second file of a first-time
   multi-drop no longer flips the audit line to "Updated" / fabricates history.
4. **Rider dropzone accepted non-rider PDFs as riders.** A hotel booking's
   "ROOMING LIST" text tripped the legacy lodging heuristic, installing the
   hotel PDF as the active rider and overwriting the artist name. Parses now
   require ≥ 3 sections; files matching a known non-rider fixture get a
   "belongs to another step" note.
5. **Post-import homepage was a silent blank.** `TodaySurface` returned `null`
   off-tour, so with the future-dated sample tour (today = Jul 11, tour =
   Sep 22–28) the "Today" page showed a hole for the entire demo. A pre-tour
   card now renders ("Tour starts Tuesday, September 22 — 73 days away · First
   show Fri, Sep 25 in Mexico City") with First-day-sheet / Calendar buttons.
6. **A stalled PDF parse bricked the import forever.** No timeout existed
   anywhere; in restricted browser environments pdfjs canvas rendering can hang
   even though text extraction works, leaving "Parsing PDF…" up permanently.
   Plot rendering now times out per page (10s) and bails after the first stall
   (plots stay imageless — graceful degradation); the whole rider parse has a
   60s last-resort cap that fails into the existing fixture-fallback/notice
   path. Discovered empirically: canvas `page.render()` hangs in embedded
   browser panes while extraction succeeds.

### High

7. **Committed flights kept stale times after a merge.** AppState's
   additive-merge fast path ignored flight-metadata changes, so re-uploading a
   rescheduled confirmation (same passengers, new departure time) silently kept
   `status: 'imported'` — day sheets showed the old time forever. The predicate
   now mirrors `diffFlightImports`: any time/airport/PNR change, or an added
   passenger who didn't match the roster, reverts to review.
8. **Removing a person had no guards.** The TM could remove themself (permanent
   manager lockout, survives reload) or the last person (white screen).
   `removeTourPerson` now refuses to remove the last person or the last
   manager; the Personnel modal hides Remove in those cases; removing the
   currently-viewed person falls back to a manager viewer.
9. **Deleted gear items resurrected on every reload.** The rider→gear merge
   effect ran on every mount. A persisted `gearSeedRiderId` now guards it.
10. **Accent-sensitive name matching.** Passenger/rooming matching was exact
    `trim().toLowerCase()`, so "Manuel Gonzalez" (parsed) never matched
    "Manuel González" (grid/hotel docs). A shared `normalizeName` (NFD, strip
    diacritics, collapse spaces) is used by the grid CSV, flight/hotel fixtures,
    and the PDF parser. Verified live: 0 unmatched passengers across both legs.
11. **Four dead buttons removed** (silent no-ops a client would click):
    Publish (Day Sheet), CSV import (People), Add item (Day Detail — now links
    to the day sheet), Re-extract (rider sections). Publish-flavored copy
    removed with them ("Push notifications fire on publish", "Sheet not
    published · Review today", "Locked · published").
12. **Permissions help copy stated the opposite of reality** ("every type
    starts locked" / "locked-by-default seed" — the seed is everyone-sees,
    managers-edit). Rewritten in both places.
13. **Onboarding said "Three documents" with a 3-step list** while the
    walkthrough said four; hotels were missing. Intro now lists all four steps;
    reset copy mentions hotels.

### Medium / forgiveness / polish

14. **Walkthrough navigation fought the presenter.** Any mid-step detour was
    yanked back; Back onto a completed step bounced forward after 650 ms;
    restart rapid-fired through completed steps. Auto-navigation now fires only
    on step entry, and auto-advance only on a false→true transition of the
    step's completion predicate.
15. **Out-of-order imports stranded data invisibly.** Flights/hotels imported
    before the route landed on `day_unknown` and never appeared anywhere.
    Both sections now show an "Import the route first" warning while the tour
    has no days.
16. **Broken source-file affordances.** The flight review's filename chip
    iframed the SPA fallback (the app inside its own modal) for any non-sample
    PDF; same pattern on two Supplies & Costs links. Click affordances now
    render only for known sample files. The fake "Mocked PDF preview" footer
    line was deleted.
17. **Hotel import claimed advance tasks that the live parser never created**
    (`tasks: []`). `parseHotelPdf` now synthesizes the rooming-list and
    checkout tasks (deterministic ids, so re-upload replaces).
18. **Route re-upload hint overpromised** ("edits… are preserved") while the
    action wipes Day-Sheet-Edit-mode schedule edits. Copy now states exactly
    what's kept (locks, permissions) and what isn't (schedule edits).
19. **Reset now re-arms the walkthrough** (clears `walkthrough-seen`), so a
    mid-demo reset greets like a first visit after reload.
20. **Confirmations added** to roster Remove (rider suggestions) and member
    access Revoke — both were one-click destructive.
21. **Router error boundary** — a friendly "This page hit a snag / your data is
    safe" card instead of React Router's raw error page; plus crash guards on
    two non-null group lookups (Personnel, print sheet).
22. **Search respected visibility seeds, not edits.** Cmd+K now layers the
    manager's saved visibility edits, so blocked items are hidden from search
    exactly as they are from day sheets.
23. **Conflicts doubled after a rider v2 upload** (all revisions were scanned
    with static conflict ids). Conflicts now derive from the active rider only.
24. **Jargon / label sweep:** "Parsed" → "Imported"; "Parsing" chip → "Reading";
    "N block" → "N hotels"; "Hidden" → "Blocked" (matching the legend);
    rider-approved count denominator fixed (could never reach N/N); "Rider
    conflicts" → "Document conflicts"; parse-failure notes rewritten without
    "fixture/console/stack"; "This prototype matches by filename" → plain
    suggestion of the sample file; empty states now say what to actually do;
    walkthrough step title matches the real button ("Approve & import"); empty
    travel-grid CSV now gets a "No flights found" note instead of silence.
25. **Id-collision fixes:** manual gear items and new schedule items could
    reuse a live or deleted id after deletes (double-edit/double-delete,
    grafted history). Both now collision-check; schedule-item history appends
    instead of replacing. Calendar's lock count now intersects with current
    tour days (orphaned locks can't show 9/7).

---

## Known gaps (not fixed — decide before/after the demo)

- **No dirty-state guard on unsaved edits.** Day-sheet Edit drafts are lost by
  switching day/mode; `/schedule` visibility drafts are lost by clicking
  another item (there's an "Unsaved" chip but nothing intercepts). Biggest
  remaining forgiveness gap.
- **`parseHotelPdf` doesn't match the current generated hotel-PDF layout**
  (the generator's booking-invoice redesign dropped the standalone `HOTEL`
  anchor row the parser looks for). The shipped sample PDFs import correctly
  via the fixture fallback — the demo path is safe — but a client's own hotel
  PDF will politely fail. Fix = re-anchor `parseHotelPdf` on
  `BOOKING CONFIRMATION` / `CHECK-IN` labels (see `scripts/gen-flight-pdfs.mjs`).
- **Route re-upload still wipes day-sheet schedule edits** (copy is now honest
  about it; a diff-merge is the real fix).
- **Rider-section approvals are keyed by type+index**, so approvals can
  misalign across structurally different rider versions (v2 with an inserted
  TOC entry). Avoid demoing "upload rider v2 after approving sections".
- **Plot images rehydrate from the canonical fixture PDF on reload** — correct
  for the demo rider, wrong if a client uploads their own rider, then reloads.
- **Live-parsed rider sections classified `other` are dropped from the review
  rail** — an unrecognized TOC heading silently disappears.
- **Supplies & Costs seeds from the Elsa fixture regardless of which rider was
  parsed** — fine for the scripted demo, wrong for "upload your own rider".
- **Local submissions ignore the viewer** (all get uid `local-user`), so `/me`
  shows every viewer's submissions; approved submissions store a session-scoped
  blob URL in `Document.liveLink` (dead after reload; nothing renders it yet).
- **Flight-resolution residue:** per-name resolutions aren't cleared after
  commit; resolving the same unknown name as "Add new" on two legs creates two
  placeholder people.
- **Timestamp formats vary** (raw ISO with T stripped vs locale strings vs
  12-hour) across FlightIngest/Submissions/Conflict modals.
- **Unlocking a day is one click** while locking prompts for a reason — the
  riskier direction has less friction.
- **Confirmation patterns are mixed** (styled modal vs `window.confirm` vs
  inline two-step). Everything destructive now confirms *somehow*; unifying on
  the Modal is cosmetic debt.
- **Embedded/restricted browser environments can't canvas-render PDFs** —
  plots degrade to imageless there (by design after fix #6); normal Chrome is
  unaffected.

## Demo-safe script notes

- **Follow the walkthrough in order** with the exact sample files. The order
  guards now warn if someone jumps ahead.
- The **duplicate-flight flow is genuinely demo-worthy**: import the grid, then
  drop `AM19_…pdf` — the Replace/Merge diff banner is correct and clear.
- Switching the TopBar viewer is now safe for any person, including crew.
- Avoid live: uploading a *second rider version* after approving sections
  (approval keys may misalign); "try your own hotel PDF" (falls back with a
  warning); route re-upload after hand-editing day-sheet times (edits are
  rebuilt from the CSV).
- If anything looks stuck mid-demo: **Reset** (banner, confirms first) now also
  re-arms the walkthrough after a reload.

## Verification record

- `npm test` — 11 files, 89 tests, all passing (one assertion updated for the
  intentional copy change in `fixtureMatcher`).
- `npx tsc -b` — clean. `npm run build` — succeeds (pre-existing >500 kB chunk
  warning; not a blocker; code-splitting is future work).
- Browser end-to-end on a fresh profile: route CSV → rider PDF (live parse,
  15 sections, artist/PM extracted, 13 crew) → travel grid (2 legs, **0
  unmatched**) → approve both → 2 hotel PDFs in one drop (2 hotels on correct
  check-in days, rooming matched 8/8, advance tasks present, audit line
  "Imported", `updates: 0`) → pre-tour Today card → Sep 25 day sheet → viewer
  switch TM → Elsa → TM.
