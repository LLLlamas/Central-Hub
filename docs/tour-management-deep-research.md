# Tour Management Software: Deep Research for a Central-Hub App

**Focus:** arena/stadium-scale touring · workflow & info-flow angle
**Purpose:** Understand how the work actually happens, where the single source of truth lives at each stage, what existing apps do well/poorly, and where the gaps are for a new central-hub app.

---

## 1. The People & Departments You're Building For

At arena/stadium scale, the tour is no longer one person juggling tasks — it's a small organization with department heads who each "own" a slice of the data. Your app is essentially a multi-tenant CRM/operations tool for this organization.

### Off-tour but constantly involved
- **Artist Manager** — career-level decisions, signs off on tours
- **Booking Agent** — sells the shows; produces the route and deal memos
- **Business Manager / Tour Accountant** — budget, payroll, settlements
- **Promoter Rep** (Live Nation / AEG) — paid by the promoter, often travels with the tour, runs settlement at each stop
- **Travel Agent** — flights, ground, hotel blocks
- **Publicist** — press schedule and media engagements

### On the road — leadership
- **Tour Manager (TM)** — runs the people side: travel, lodging, hospitality, money, day sheets, the artist's day. Ultimately responsible for getting the band paid and on the bus on time.
- **Production Manager (PM)** — runs the show side: load-in, trucking, labor calls, audio, lights, video, scenic, power, rigging, carnets, schedule. The PM is "the boss of the crew" and owns the production rehearsals, the truck pack, the show clock.
- **Stage Manager** — runs the deck day-of: load-in, on-site labor, truck pack, keeping the build on time and safe. Often hired by the artist on big shows.
- **Production Assistant (PA)** — catering/hospitality/runners/laundry; the "go-to" for anything that needs a quick answer.

### On the road — technical departments
Each is its own mini-team with a department head on bigger tours:
- **Audio** — FOH engineer, monitor engineer, RF tech (wireless/IEMs), system techs (PA tuning)
- **Lighting** — Lighting Designer (LD), board op, dimmer techs, followspot ops
- **Video** — director, camera ops, LED wall techs, IMAG
- **Backline** — guitar, drum, keyboard, bass techs (instrument prep, in-show changes)
- **Rigging** — riggers fly the rig from the venue ceiling; first in, last out
- **Automation** — moving scenic elements, lifts, winches
- **Pyro / SFX** — pyrotechnics, cryo, confetti, lasers
- **Wardrobe** — costumes, quick changes
- **Playback / "tracks"** — runs supplemental music, often controls light/video timecode
- **Content** — touring photo/video for socials
- **Security** — personal security plus venue/crowd interface
- **Catering** — touring chef on bigger productions
- **Merch** — touring seller plus venue-side coordination

### The trucking/freight layer (critical at arena+)
- 50–90+ trucks on a stadium tour (Eras Tour: 90+; typical arena tour: 12–20)
- Drivers stay with the tour for the full leg; drive overnight in coordinated convoys
- Sub-tours-within-the-tour: rigging trucks roll out first, lighting/audio/video next, then production/backline. Load-out reverses this.
- Real-time truck tracking (HET Hub etc.) feeds the PM dashboard so they know what's where

### The local layer at every stop
- **Venue Production Manager** or **Promoter Rep** is the tour's counterpart at each stop. They book stagehands, runners, catering, security, dressing rooms.
- Stagehand calls are sized to match the truck count and the rigging plot — getting this number wrong wastes money or stalls the build.

**Implication for your app:** at minimum, your data model needs `Person → Department → Role → Tour → Show`, with Persons potentially having multiple Roles across multiple Tours simultaneously (a tech might do FOH for Artist A on tour and LD for Artist B on a one-off).

---

## 2. The Tour Lifecycle — Where Information Comes From and Where It Goes

Information flows through five distinct phases. Each phase has its own "source of truth," and a key insight is: **no single system today owns all of it.** The tour manager mentally stitches them together.

### Phase 1 — Booking (months to years out)
**Source of truth:** the booking agent's deal memos + a routing spreadsheet
**What's created:** show dates, venues, capacities, deal terms (guarantees, splits, holds vs. confirms, ticket prices)
**Hand-off:** the agent emails the deal memo to the tour. The TM/PM enter routing into Master Tour or Daysheets manually. **This is where data first hits a tour app — usually by retyping.**

### Phase 2 — Pre-production / Advance (8–12 weeks out, intensifies at 2 weeks)
**Source of truth:** advance email threads + the latest tech rider PDF
**What happens:** the PM contacts each venue's PM/promoter rep. They exchange:
- Technical rider (audio specs, console preferences, power, rigging plot, lighting plot)
- Stage plot (top-down diagram of band positions, amps, monitors, mics)
- Input list (every channel: kick, snare, vocal mics, DI, etc.)
- Hospitality rider (dressing rooms, dietary needs, towels, water)
- Pass sheet / credentialing scheme
- Truck count, bus count, parking needs
- Proposed schedule (load-in, soundcheck, doors, set times, curfew, load-out)
- Local labor call needs
- Carnet info (international)
- Fire certifications for soft goods

**The huge pain here:** version control on the rider. Bands update riders mid-tour-cycle and old PDFs float around. From a venue PM's perspective, the worst thing is showing up at load-in with a stage plot two versions out of date. Apps like **Showvella** and **RiderForge** exist *only* to solve this — they version-stamp the docs and serve them via a single link/QR that always points to current. This is a clue: **a real source-of-truth app for the rider/plot/input list is currently a separate product.** Master Tour and Daysheets do not own this layer well — they treat rider docs as attachments.

### Phase 3 — Production rehearsals (1–4 weeks before tour kickoff)
**Source of truth:** the rehearsal room
**What happens:** the full production loads into a rehearsal facility (a soundstage or arena), the show is built, programmed, and rehearsed with the artist. Cues are programmed into lighting and video desks, IEMs are dialed in, automation is choreographed. Day sheets begin daily.

This is where a lot of "tribal knowledge" gets generated that never makes it into any system: which song uses which IEM mix, which cue calls which automation move, which guitar tech preps which guitar for which song. Most of this lives in department-specific spreadsheets and Word docs.

### Phase 4 — Show day (every day on the road)
**Source of truth:** the day sheet
This is the canonical document of touring, and it's why the competing app is literally called "Daysheets." A day sheet is the single page (per person/department) that answers: *what do I need to know, today.*

**Standard day sheet contents** (synthesized from multiple production-management sources):
- Date, day of week, city, venue name + address
- Tour day number / show number
- Weather, sunrise/sunset
- WiFi, hotel info (often only on TM/artist version)
- Show clock: bus call, lobby call, load-in, breakfast, lunch, soundcheck, doors, opener set, changeover, headliner set, encore, curfew, load-out, bus departure
- Local crew call sizes (per department)
- Catering hours and meal times
- Dressing room assignments
- Press / promo schedule (artist version only)
- Key venue contacts (PM, FOH, monitors, LD, security, runner, promoter rep)
- Hospital location, nearest pharmacy
- Notes / day-specific info ("water buyback at $1, 4 IEM packs back from repair," etc.)

**Critical permission point:** the artist's day sheet has press, hotel, security details that the audio crew doesn't need (and shouldn't have). The audio tech's day sheet has stagehand call info that doesn't matter to the artist. **Customizing day sheets per role/department is one of the most-cited needs in the industry**, and it's the central feature pitch from Daysheets and a core feature of Master Tour's permission system.

### Phase 5 — Settlement & post-show (every night, then post-tour)
**Source of truth:** the box office settlement sheet + the tour accounting spreadsheet
**What happens:** TM (or promoter rep) settles the show — ticket counts, walk-up, comps, fees, splits, taxes, expenses. Cash and checks deposited. Per diems paid. Crew payroll submitted. Hotel folios verified. At end of tour, full P&L produced for management.

This is the **other** layer that no current app owns end-to-end. Master Tour has accounting; Daysheets does less. Most tour accountants still live in Excel.

---

## 3. Competitive Landscape

### Master Tour (Eventric)
- **Founded:** 2009. The incumbent. Used by Beyoncé, Florida Georgia Line, Fleetwood Mac, Disney on Ice, Harlem Globetrotters.
- **Architecture:** desktop-first (Mac/Windows/Linux) for input, mobile (free, unlimited users) for read-only consumption by crew. Web portal for limited viewing.
- **Pricing model:** ~$49.99/mo per admin user (last public number); crew/band/techs free. Artist usually pays.
- **Pros:** mature, comprehensive, has accounting + guest list + venue database (15,000+ venues, 150,000+ personnel), real-time co-editing, offline mode, granular permissions. "Tags" feature is a Yelp-for-touring (best coffee in Seattle, best guitar tech in Biloxi).
- **Cons (from app store reviews and a prominent Daysheets review):**
  - Recent UI overhaul widely disliked ("worst update ever," "borderline unusable")
  - Attachments slow/unreliable
  - Desktop-first feels dated in 2026
  - Steeper learning curve
- **Modules adding on:** Master Venue (stage plots, dressing rooms, parking), Master Tour Crew, Master Tour Ticketing, Live Access (ticket blocks).

### Daysheets
- **Positioning:** "modern, mobile-first" insurgent. Strong word-of-mouth among newer tour managers ("far and away better than any of their competitors").
- **Strengths:**
  - Best-in-class mobile UX (iOS especially)
  - "Group Tags" — sub-groups within primary groups, allowing per-role personalization of itineraries (this is exactly the permissions/visibility model you want to study)
  - Daysheets Travel — bulk import flights, AI travel-doc parsing, Flight Grid view, FBO search, charter handling, timezone handling
  - PWA for offline-like access; native MacOS app for tour creation
  - Active dev cycle; founders responsive to user feedback
- **Weaknesses:**
  - Smaller user base than Master Tour
  - Android lags iOS (verified in Play Store reviews)
  - Less mature accounting/finance than Master Tour
  - No deep integration with industry-standard booking systems

### Tourmanagement.com
- Newer, organization-level (one company, multiple artists, multiple tours)
- Permission scoping is a primary feature
- Venue database, guest list workflow, crew + travel sync
- Less established at the very top of the market

### Smaller / niche
- **GigSheets / Tour Sheets** — DIY/club level
- **TourDeck** — explicitly "for working musicians, not stadiums"; has stage plot drag-and-drop + one-click advance email
- **My Tour Book** — itinerary-focused
- **Touring Pro (YourTempo)** — admin-permission-centric, automated day sheet PDFs, role-based access
- **All Access Advance** — tour-wide advance + day-sheet generation, scalable pricing

### Adjacent / single-purpose apps that point to gaps
- **Showvella, RiderForge, TecRider** — stage plot + input list + tech rider with revision tracking and QR-code current-version links. *None of the big tour apps own this layer well.*
- **HET Hub** — real-time truck tracking for the production team. *None of the big tour apps integrate this well.*
- **StudioBinder** — film call sheets with department-specific notes, weather, walkie channels, page breaks for clean PDFs. *Touring's day-sheet UX is well behind film's call-sheet UX.*
- **Mosaic (resource management), Studiovity (film crew)** — best-in-class role-based crew/department permission systems from outside live music. Worth studying for permissions UX.

---

## 4. The Permissions Model (The Hard Part)

This is the single most important architectural decision in your app, and it's where existing tools are weakest. The pattern that has emerged in the industry is roughly:

**Three tiers of access:**
1. **Admin / Manage All** — TM, PM, sometimes the artist's manager. Sees and edits everything.
2. **Department Manager / Edit** — head of audio, head of lighting, head of video, head of merch, etc. Can see and edit their slice; can read most of the rest; cannot see hotel addresses, financials, artist personal info.
3. **Crew / View Only** — mic techs, riggers, bus drivers, content creators. See only their day sheet (filtered to their group) plus the venue contact list and the public schedule.

**Visibility dimensions** (Master Tour and Daysheets both use combinations of these):
- **By group** (audio, lighting, video, merch, security, artist, mgmt, crew-bus, vendor-bus)
- **By person** (specific item visible only to a single named person)
- **By item type** (schedule items, travel items, hotels, tasks, contacts can each have separate visibility)
- **By tour phase** (some info visible to advance crew but not show-day crew, etc.)

**The Daysheets "Group Tags" model** is the most refined public example: primary groups (e.g., "Audio") with sub-groups within (e.g., "Audio — FOH" vs. "Audio — Monitors") so a single update can target very precisely without admin re-tagging.

**Sensitive info that is constantly leaking and shouldn't be:**
- The artist's hotel address
- The artist's flight numbers
- Door codes, dressing room codes
- Artist's personal cell, family contacts
- Show financials, deal terms
- Security protocols / threat assessments

A real differentiator for your app could be a **"public day sheet vs. private day sheet"** automatic split: any item tagged sensitive is auto-redacted on the printed/posted version, while the digital version preserves it for permitted users.

---

## 5. The Information Architecture That Emerges

Pulling all of the above together, here's the data model implicit in how the work actually happens. This is the spine your app should be built on.

### Core entities
- **Organization** (the artist team / management company — top of the tree)
- **Tour** (belongs to Organization; has dates, legs, status: announced/on-sale/in-progress/wrapped)
- **Leg** (a contiguous run of shows; tours are usually broken into legs by routing or by month)
- **Show / Day** (the atomic unit; every day on the calendar is one of: show day, travel day, day off, rehearsal day, promo day, hold day)
- **Venue** (separate entity; reused across tours — should be a global database)
- **Person** (separate entity; reused across tours — should be a global database)
- **Role** (Person + Tour + Department + Title + Date range; allows the same Person to have different roles across tours)
- **Group / Department** (Audio, Lighting, Video, Backline, Production, Artist, Mgmt, Vendor, Bus 1, Bus 2, etc.)
- **Vehicle** (bus number, truck number; ties to drivers and to crews assigned)

### Per-show entities (hang off Day)
- **Schedule items** (load-in, breakfast, soundcheck, etc. — each has start/end, location, attendee groups, visibility)
- **Travel items** (flights, drives, ferries, trains — Daysheets explicitly added bus/ferry/train support)
- **Hotel reservations** (per person/group)
- **Hospitality items** (catering, dressing room assignments)
- **Local crew call** (per department, with count and call time)
- **Tasks** (assigned, due-dated, optionally show-attached)
- **Guest list requests** (with workflow: requested → approved → at box office)
- **Settlement** (ticket counts, fees, expenses, splits)
- **Notes / attachments** (rider versions, stage plots, etc.)

### Cross-cutting
- **Documents** with versioning: the rider, the stage plot, the input list. Every send-out should be stamped, and every recipient should have a single link that auto-updates.
- **Notifications**: any change to a schedule item or travel item with a watch-list (everyone in affected groups) gets a push.
- **Audit log**: who changed what, when. (Critical for accounting and disputes.)

---

## 6. Workflow Walkthrough — How a Day in the App Should Look

To pressure-test the model, here's how an arena tour day uses the system from each angle:

**6:00 AM** — Trucks arrive. The PM opens the app and sees the truck tracking widget (HET Hub or similar integration) confirming arrival. The local stagehand crew chief opens their crew-only view, which shows just the load-in schedule, the rigging plot, and the PM's contact card.

**8:00 AM** — Riggers go up. The lighting head's view shows the lighting rig schedule, the truss build, and the FOH position. He has edit rights on lighting tasks, view rights on everything else.

**Noon** — Soundcheck setup. The FOH engineer opens her view: today's set list, the IEM mix assignments, the input list (current revision), the stage plot. She doesn't see hotel info or the artist's press schedule.

**3:00 PM** — Artist arrives. The TM's view shows the full day: artist arrival, meet & greets, press, dinner, set time, after-show, hotel. The artist's own view shows only their personal schedule plus tonight's set list.

**4:00 PM** — Press junket runs late by 30 minutes. TM updates the artist's press block. The system pushes the change *only to people watching that block* (the publicist, the artist, the security lead) — not to the entire crew, who don't need the noise.

**8:30 PM** — Show. Stage manager has the run-of-show open on a tablet, with cues and call times.

**11:00 PM** — Load-out. Everyone reverts to their trucking view. Drivers see their convoy departure time + next venue address.

**Midnight** — Promoter rep settles with TM. Settlement screen pulls in ticket counts, computes splits, generates the settlement sheet. Cash deposit recorded.

**1:00 AM** — TM hits "publish tomorrow's day sheet." Each person gets a push with their personalized version.

This is the loop. The app's core job is to make this loop *fast*, *correct*, and *role-appropriate*.

---

## 7. Pain Points Existing Apps Don't Solve Well (Your Opportunity)

These are the gaps reported across reviews, industry articles, and adjacent-product positioning:

1. **Rider/stage plot versioning is separate from the tour app.** Showvella exists because Master Tour and Daysheets don't do this well. *Your app could ingest, version, and serve riders/plots/input lists with a single live link per show.*
2. **Booking/agent → tour app handoff is manual.** Routes are emailed as spreadsheets and retyped. *A standardized import (CSV, or partnerships with booking platforms) would save days.*
3. **Truck tracking is in a separate product.** *Embed truck telemetry in the PM dashboard.*
4. **Day sheet customization per role is shallow.** Everyone touts it; few do it deeply. *Templates per department, automatic redaction of sensitive info on posted/printed versions.*
5. **Settlement/accounting still lives in Excel for most tours.** Master Tour has tools but they're underused. *A clean, mobile-friendly settlement flow with photos of cash counts + approval signatures is wide open.*
6. **Onboarding new crew mid-tour is painful.** A new tech joins on day 12, and they have to be added to every group/visibility setting individually. *Templates ("New audio sub" provisions all the right access in one click).*
7. **Offline reliability is genuinely critical.** Venues have terrible reception. Both Master Tour and Daysheets cache; reviews still complain about sync issues. *A proper local-first architecture (CRDTs / offline-first store) would be a moat.*
8. **The "two crews on one tour" problem.** A support act and a headliner share the day, but each has its own crew, riders, hotels, buses. Most apps treat this as one tour or two; neither is right. *A multi-org show model where the headliner's PM coordinates with the support's TM, with explicit cross-org visibility rules.*
9. **Mid-conversation document creation.** A change made in Slack/email/text never makes it back into the system. *Better integrations (Slack, email, SMS) so that the system is the system of record and chat is just the conversation layer.*
10. **Knowledge from past tours is lost.** Every tour starts from scratch. *A "tour template" + "venue history" view: "last time we played MSG, our load-in took 5 hours, we needed 2 extra riggers, and the runner was named Pat."*

---

## 8. Recommended Build Order (When You're Ready)

Given the scope, you can't build all of this at once. The advice from the industry — including a SmartistU/Berklee theme — is **start with the single biggest pain point and own it**. For arena/stadium scale, I'd argue the order is:

1. **Show calendar + day sheet generator** with role-based visibility (Group Tags model). This is the daily-use surface; everything else hangs off of it.
2. **Personnel + venue databases** (reusable across tours). Without this, every new tour is a re-entry slog.
3. **Travel + hotel grid** with bulk import (Daysheets did this and it's a killer feature).
4. **Rider / stage plot / input list with revisioning** and a single live link per show (the gap Showvella exploits).
5. **Guest list workflow** (request → approve → BO list).
6. **Settlement + per-show accounting** (the Excel killer).
7. **Truck tracking + crew call integration** (PM dashboard).
8. **Cross-tour analytics** (venue history, "last time we were here…").

Each of these is a meaningful product on its own. Together they're a Master Tour competitor.

---

## 9. Tech Stack Notes (For Your React/Vite + Node Strengths)

You already work in React/Vite + Node/Express; this is a great fit. A few specific notes for this domain:

- **Offline-first matters.** Look at libraries like [PowerSync](https://www.powersync.com/), [RxDB](https://rxdb.info/), [TinyBase](https://tinybase.org/), or roll your own with IndexedDB + a sync queue. CRDTs (Yjs, Automerge) are worth studying for the "two TMs editing at once" case.
- **Mobile-first PWA** likely beats native apps for v1 (Daysheets started as a PWA). Native iOS later for the polish.
- **Permissions model** — implement as ABAC (attribute-based access control) not RBAC. The reality is more like "this person, on this tour, in this group, can see items tagged X for date Y" — not flat roles.
- **PDF generation** (day sheets are still printed and posted backstage) — Puppeteer or a service like react-pdf.
- **Push notifications** for change alerts — web push works on iOS 16.4+; otherwise use OneSignal or Firebase Cloud Messaging.
- **AI usefulness** (for a Lorenzo-style integration): parsing flight confirmation emails, extracting rider PDFs into structured input lists, summarizing tour-day changes for the artist's morning brief, drafting advance emails. This is exactly Daysheets' "Daysheets AI" pitch — and you can compete on it.

---

## Sources

Master Tour (Eventric): eventric.com, App Store, Google Play, Performer Mag interview with founder Paul Bradley, LinkedIn company page, sourceforge.net listing.
Daysheets: daysheets.com, App Store reviews, Korda review, daysheets.com/pricing.
TourManager.info: extensive series on advancing, day sheets, personnel roles, festival advance, software comparison.
TheEfficientHustle.com: industry-practitioner blog on advancing and roles.
Backstage Culture: jobs and titles on tour breakdown.
Berklee Careers, SmartistU, ThisTourLife — practitioner perspectives.
Trucking layer: Averitt Express, Drive My Way, Valley Trucking Insurance (Eras Tour logistics piece), nerdbot.com (HET Hub coverage).
Adjacent products: Showvella, RiderForge, TecRider, TourDeck, Tourmanagement.com, GigSheets, TouringPro/YourTempo, StudioBinder (film), Studiovity (film), Mosaic (PM).
Production/rider standards: NAMM festival rider session, Gearspace forum, Stage Portal, OffTrailStudios.

