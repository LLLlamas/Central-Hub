# Potential Implementation — Tour Ops Hub

A starter playbook for building the central tour management hub. The structure here mirrors the build order from the research guide: get the data model right, build for one TM first, then expand. Sections marked `[STUB]` are stretches of code or schema you'll fill in as you go.

---

## 1. The mental model before any code

Before opening an editor, internalize these three principles. Every architectural decision flows from them.

1. **One TM is the customer, not "the touring industry."** Build to make one real tour manager faster than they are today. Marketing comes later.
2. **The day sheet is the spine.** Everything else (personnel, travel, riders, settlement) hangs off the daily output. If a feature doesn't make the day sheet better or the data entry easier, defer it.
3. **Ingest is the wedge.** Daysheets won share by being good at flight PDFs. The hub wins by being good at every PDF — riders, hotels, advance docs.

If a decision conflicts with one of these, the principle wins.

---

## 2. Data model (do this first)

Spend two weeks on paper before writing schema. The entities are mostly obvious; the trick is the visibility layer.

### Core entities

```
Organization
  └── Tour
        ├── Leg            (contiguous run of shows)
        ├── Day            (every date; has DayType)
        │     ├── Show           (only if DayType=show)
        │     │     └── Venue   (global, reusable)
        │     ├── ScheduleItem*  (load-in, soundcheck, bus call, etc.)
        │     ├── Travel*        (flight, drive, ferry, train)
        │     ├── Hotel*
        │     └── Task*
        ├── TourPerson*    (Person + Role + Group + GroupTags + DateRange)
        └── Document*      (rider, plot, input list; with revisions)

Person  (global, reused across tours)
Venue   (global, reused across tours)
```

`*` = has a Visibility specification (see below).

### The DayType enum

Every Day has exactly one DayType. This drives templates, calendar coloring, and which sub-records can attach.

- `SHOW` — has Show, ScheduleItem(s), often Hotel, sometimes Travel
- `OFF` — usually has Hotel, sometimes Travel
- `TRAVEL` — has Travel records
- `REHEARSAL` — has ScheduleItem(s), sometimes Hotel
- `PROMO` — press day; has ScheduleItem(s)
- `HOLD` — venue held but not confirmed; mostly placeholder

### Visibility — the hard part

Every ScheduleItem, Travel, Hotel, Document, and Task has a `visibility` blob. It's an attribute-based access spec, not a flat role check:

```typescript
type Visibility = {
  // Default for everyone not matched below
  default: 'blocked' | 'sees' | 'needs' | 'owns';

  // Override for specific groups
  groups?: {
    [groupId: string]: 'blocked' | 'sees' | 'needs' | 'owns';
  };

  // Override for specific group tags (sub-groups like "Audio")
  tags?: {
    [tagId: string]: 'blocked' | 'sees' | 'needs' | 'owns';
  };

  // Override for specific individuals
  persons?: {
    [personId: string]: 'blocked' | 'sees' | 'needs' | 'owns';
  };

  // Most specific wins: persons > tags > groups > default
};
```

Remember the hierarchy: **Owns implies Needs implies Sees.** The stored level is always the highest one that applies.

### Example: a press junket schedule item

```json
{
  "type": "schedule_item",
  "title": "Press junket - Rolling Stone",
  "day_id": "day_2026-06-14",
  "start": "16:00",
  "end": "16:45",
  "visibility": {
    "default": "blocked",
    "groups": {
      "a_party": "needs",
      "mgmt": "needs"
    },
    "tags": {
      "security_lead": "sees"
    },
    "persons": {
      "publicist_001": "owns"
    }
  }
}
```

This says: by default nobody sees this item. The A Party group (artist + close circle) and Management group both need to see it. The security lead just needs to see the timing. The publicist owns it and can edit it.

### Postgres implementation

Use row-level security to enforce visibility in the database, not the application layer. The naive approach (filter in JavaScript) leaks data on every refactor.

```sql
-- [STUB] simplified — production version is more nuanced
CREATE POLICY schedule_visibility ON schedule_items
  FOR SELECT
  USING (
    visibility_for_user(id, current_user_id()) != 'blocked'
  );
```

`visibility_for_user(item_id, user_id)` is a Postgres function that resolves the most-specific match for that user against the visibility blob, returning their access level. Application code never has to think about permissions — it just queries and gets back what the user is allowed to see.

---

## 3. The starter stack

What I'd actually build with, based on your existing strengths.

| Layer | Pick | Why |
|---|---|---|
| Frontend | React + Vite, PWA | Your wheelhouse; PWA installs on phones without app stores |
| Hosting | Vercel (frontend), Railway or Fly.io (backend) | Cheap, fast, no DevOps overhead |
| Backend | Node + Express | Your wheelhouse; the boring choice |
| Database | Postgres (Supabase or Neon) | Row-level security for the visibility layer |
| Auth | Clerk or Supabase Auth | Don't build this yourself |
| File storage | Cloudflare R2 or S3 | PDFs, stage plots, receipts |
| AI ingest | Anthropic API (Claude Sonnet) | Structured output for parsing |
| Offline | RxDB or PowerSync | Venues have terrible cell service |
| Push notifications | Web Push (iOS 16.4+) or OneSignal | Day sheet changes |
| PDF generation | Puppeteer or react-pdf | Day sheets posted backstage |

Total infra cost to run v1 for one tour: ~$30/mo. Anthropic API costs scale with rider parsing volume; budget $0.30 per rider parsed.

### Project structure

```
tour-hub/
├── apps/
│   ├── web/              # React + Vite PWA
│   │   ├── src/
│   │   │   ├── routes/      # Calendar, Day, Personnel, Documents
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── lib/
│   │   └── public/
│   └── api/              # Node + Express
│       ├── src/
│       │   ├── routes/
│       │   ├── services/    # business logic
│       │   ├── ingest/      # PDF parsing pipeline
│       │   └── db/
│       └── prisma/          # or drizzle, your choice
├── packages/
│   └── shared/           # types, validators, visibility resolver
└── docs/
```

Use Drizzle or Prisma. Drizzle is closer to raw SQL (helps with RLS); Prisma is faster to write. Either works.

---

## 4. The minimum viable hub — six features in order

Each is its own small product. Ship one before starting the next.

### Feature 1: Calendar + DayType picker

A grid of dates. Click a date to set its DayType. Click again to add details. That's it.

- Routes: `/tours/:tourId`
- Components: `<TourCalendar />`, `<DayPicker />`, `<DayDetailDrawer />`
- API: `GET /tours/:id/days`, `PATCH /days/:id`

Reference: Master Tour's Setup Wizard. Match its speed.

### Feature 2: Personnel with Groups and Group Tags

Add people. Assign them to Groups (A Party, B Party, Crew). Add Group Tags within Crew (Audio, Lighting, Video). Three input paths:

- **Search/create** — type a name; existing people from your other tours surface; create new with just name + role
- **CSV import** — drag a spreadsheet, map columns
- **Copy from previous tour** — pick a past tour, select what to bring

This single feature is what gets a TM to switch from Master Tour. Daysheets won on this.

- Routes: `/tours/:tourId/personnel`
- API: `POST /tours/:id/personnel`, `POST /tours/:id/personnel/import-csv`, `POST /tours/:id/personnel/copy-from/:fromTourId`

### Feature 3: Schedule items with Visibility

Each Day has a list of timed items. Each item has a visibility spec. Build the visibility editor as a single component that you use everywhere:

```tsx
<VisibilityEditor
  value={item.visibility}
  groups={tour.groups}
  tags={tour.tags}
  persons={tour.persons}
  onChange={setVisibility}
/>
```

Schedule Templates pre-fill common day shapes ("Arena Show Day", "Theater Day", "Promo Day"). One click applies a template.

### Feature 4: The day sheet generator

The single most-used screen in the app. Two views:

- **Edit view** — TM/PM see everything for the day; can edit any item
- **Personalized view** — every other user sees their filtered version

PDF export uses Puppeteer server-side. The PDF has a revision stamp and a generated-at timestamp.

Push notification fires when a day sheet is published or materially changed. Only notifies users whose personalized view actually changed.

- Routes: `/tours/:tourId/days/:dayId`
- API: `POST /days/:id/publish`, `GET /days/:id/sheet?format=pdf`

### Feature 5: AI ingest — flight PDFs

Match the Daysheets pattern.

- User drags PDF(s) into the upload zone
- Server stores file in R2, sends base64 + prompt to Anthropic API
- Structured output returns a typed object (see schema below)
- Review UI shows source PDF on the left, parsed data on the right with per-field edit
- "Import" creates the records

Use the Claude API's structured output (response_format with a JSON schema). Schema for a flight:

```typescript
const FlightSchema = {
  type: "object",
  properties: {
    airline: { type: "string" },
    flight_number: { type: "string" },
    departure_airport: { type: "string", description: "IATA code" },
    arrival_airport: { type: "string", description: "IATA code" },
    departure_time: { type: "string", description: "ISO 8601" },
    arrival_time: { type: "string", description: "ISO 8601" },
    record_locator: { type: "string" },
    passengers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          seat: { type: "string" }
        }
      }
    }
  },
  required: ["airline", "flight_number", "departure_airport", "arrival_airport", "departure_time"]
};
```

Match parsed passenger names to existing TourPerson records. Show unmatched names in a "needs assignment" queue.

### Feature 6: AI ingest — rider PDFs (the differentiator)

The feature nobody has. Start narrow.

Riders have many sections, each with different structure. Don't try to parse the whole thing at once. Pipeline:

1. **Classify** — first pass identifies which sections are present (cover, input list, FOH, monitors, lighting, hospitality, etc.)
2. **Extract** — each section type has its own structured-output schema
3. **Review** — human approves section-by-section
4. **Store** — extracted structured data becomes part of the Show record; original PDF stays attached for reference

See section 6 below for the detailed pipeline and the schemas.

---

## 5. Multi-language support (the rider sample is in Spanish)

Important from day one: **riders are global, your hub needs to handle non-English from the start**.

Two ways to handle this:

**Option A — parse-in-language, present bilingually.** AI extracts fields in their original language, optionally generates an English translation, stores both. UI lets the user toggle. This is the right approach for non-English-speaking PMs who want their own data preserved.

**Option B — translate-then-parse.** Translate the whole PDF to English first, then parse. Simpler, but loses fidelity (proper nouns, equipment model names) and is wrong for non-English users.

**Recommendation: Option A.** It's barely more work and serves a global user base from day one.

The Anthropic API call for this:

```typescript
// [STUB] simplified
const result = await anthropic.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 4096,
  messages: [{
    role: "user",
    content: [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
      {
        type: "text",
        text: `Extract the input list from this rider. The rider may be in any language.
          Return structured data in the original language for source-of-truth accuracy,
          and an English translation for each free-text field.
          Schema: ${JSON.stringify(InputListSchema)}`
      }
    ]
  }]
});
```

Tag each extracted field with its source language. Surface both in the UI.

---

## 6. The rider parsing pipeline

The clearest market gap. Here's how to attack it.

### Step 1 — Section classification

Before extraction, identify which sections are in this rider. Send the full PDF to Claude with a classifier prompt:

```
You will be shown a touring artist's rider document. List which of the following
sections are present, with page numbers for each:

- cover_and_contacts
- stage_plot (visual diagram)
- input_list
- foh_requirements
- monitor_requirements
- lighting_requirements
- rigging_requirements
- backline_list
- power_requirements
- local_labor_call
- schedule_load_in
- dressing_rooms
- food_and_beverage
- passes_credentials
- parking_logistics
- settlement_terms

Return JSON: { sections: [{ type, pages, language_detected }] }
```

This is cheap (one API call per rider). The output drives which extractors run next.

### Step 2 — Per-section extractors

Each section type gets its own structured-output schema. The most structured sections (input list, local labor, schedule) are easiest. The least structured (food & beverage, parking notes) are noisier and may stay free-text with light tagging.

#### Input list schema

```typescript
const InputListSchema = {
  type: "object",
  properties: {
    total_channels: { type: "integer" },
    channels: {
      type: "array",
      items: {
        type: "object",
        properties: {
          channel_number: { type: "integer" },
          source: { type: "string" },
          source_en: { type: "string", description: "English translation if source is non-English" },
          mic_preference: { type: "string", description: "e.g. 'Shure Beta 91A'" },
          mic_alternates: { type: "array", items: { type: "string" } },
          stand_type: { type: "string", enum: ["boom", "short", "clip", "none", "other"] },
          phantom_48v: { type: "boolean" },
          insert: { type: "string" },
          sub_snake: { type: "string" },
          notes: { type: "string" }
        },
        required: ["channel_number", "source"]
      }
    }
  }
};
```

#### Stage plot — vision model territory

Stage plots are diagrams. Send the page as an image:

```typescript
// [STUB] extract band positions and equipment from a visual stage plot
const result = await anthropic.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 2048,
  messages: [{
    role: "user",
    content: [
      { type: "image", source: { type: "base64", media_type: "image/png", data: pageImage } },
      {
        type: "text",
        text: `This is a stage plot. List every performer position, instrument,
          monitor wedge, mic, DI box, and AC drop. Note positions as approximate
          stage zones (down-stage left, mid-stage center, etc.) since this is a
          diagram. Schema: ${JSON.stringify(StagePlotSchema)}`
      }
    ]
  }]
});
```

Stage plot accuracy will be lower than text extraction. That's fine — the UI surfaces it for human approval and lets them drag positions if the AI got them wrong.

#### Local labor call

```typescript
const LaborCallSchema = {
  type: "object",
  properties: {
    calls: {
      type: "array",
      items: {
        type: "object",
        properties: {
          department: { type: "string", enum: ["riggers", "loaders", "audio", "lighting", "video", "backline", "stewards", "spotlight_ops", "other"] },
          count: { type: "integer" },
          start_time: { type: "string", description: "24-hour, e.g. '08:00'" },
          end_time: { type: "string" },
          notes: { type: "string" }
        },
        required: ["department", "count"]
      }
    }
  }
};
```

### Step 3 — Side-by-side review UI

The most important part of the whole pipeline. The TM has to *trust* the AI. The review UI makes the trust explicit:

```
┌─────────────────────────────┬───────────────────────────────┐
│  Source PDF (page 4)        │  Extracted data — review      │
│  [rendered PDF page]        │                               │
│                             │  Input list (32 channels)     │
│                             │  ┌─────────────────────────┐  │
│                             │  │ 1 │ Kick In  │ Beta 91A │  │
│                             │  │ 2 │ Kick Out │ D6       │  │
│                             │  │ 3 │ Snare T  │ SM57     │  │
│                             │  │ ...                     │  │
│                             │  └─────────────────────────┘  │
│                             │                               │
│                             │  [✓ Accept]  [✏ Edit]         │
└─────────────────────────────┴───────────────────────────────┘
```

Click any cell to edit inline. Each field has a "source" hover that highlights where in the PDF the data came from (using bounding boxes returned by the LLM or by character-position matching).

### Step 4 — Versioning

Riders update mid-tour-cycle. Every rider import creates a new revision attached to the Tour (or specific Show, if it's a one-off variation). Old revisions stay queryable. The day sheet always pulls the latest revision; the live link per show always reflects the current.

```typescript
type RiderRevision = {
  id: string;
  tour_id: string;
  show_id?: string;          // null if tour-wide; set if show-specific override
  revision_number: number;
  uploaded_at: string;
  uploaded_by: string;
  source_pdf_url: string;    // R2 link to original
  source_language: string;
  sections: {
    [section_type: string]: ExtractedSection;
  };
};
```

---

## 7. The build order in calendar weeks

Rough timeline for a solo developer working evenings and weekends. Aggressive but feasible.

| Weeks | Goal |
|---|---|
| 1–2 | Data model on paper. Sketch all entities, visibility resolver logic. No code. |
| 3–4 | Backend scaffold. Postgres schema, RLS policies, auth, basic API endpoints. |
| 5–6 | Frontend scaffold. Calendar view, DayType picker, personnel grid. |
| 7–8 | Schedule items + Visibility editor. Day sheet HTML rendering. |
| 9 | PDF export of day sheets. Push notifications on changes. |
| 10–11 | AI ingest pipeline for flight PDFs. Anthropic API integration. Review UI. |
| 12 | First real TM uses it. Bug-fix sprint. |
| 13–14 | Rider section classifier + input list extractor. |
| 15 | Stage plot vision extraction. |
| 16 | Multi-section rider pipeline. Live link per show. |
| 17+ | Settlement, advance forms, expansion. |

By week 12 you have a TM running their tour on it. By week 16 you have the rider differentiator that nobody else has.

---

## 8. Concrete first day of work

If you wanted to start this weekend:

1. Spin up a new Vite + React project: `npm create vite@latest tour-hub-web -- --template react-ts`
2. Spin up a new Express project alongside it
3. Create a Supabase or Neon Postgres database
4. Set up Clerk for auth (free tier)
5. Write the first three tables in a migration file:

```sql
-- [STUB] starter schema, expand from here

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE tours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  name text NOT NULL,
  artist_name text NOT NULL,
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now()
);

CREATE TYPE day_type AS ENUM ('show', 'off', 'travel', 'rehearsal', 'promo', 'hold');

CREATE TABLE days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id uuid REFERENCES tours(id) ON DELETE CASCADE,
  date date NOT NULL,
  day_type day_type NOT NULL DEFAULT 'hold',
  city text,
  notes text,
  UNIQUE (tour_id, date)
);
```

6. Make a single CRUD endpoint that creates a Tour and populates Days for its date range
7. Build the simplest possible calendar view that shows those Days

That's day one. You've got the spine. Everything else attaches to it.

---

## 9. What to avoid in v1

Do not build, even if tempted:

- **A native iOS app.** PWA is fine. Native is later.
- **Settlement and accounting.** It's a whole product. Defer.
- **Multi-org SaaS billing.** Single-tenant is fine for the first 5 tours.
- **The "tour analytics dashboard."** Compounding asset that needs years of data.
- **Cross-tour features.** One tour at a time until the single-tour experience is great.
- **Email integrations (Slack, Gmail).** Real-time chat sync is hard and rarely the bottleneck.
- **Trucking telemetry / HET Hub integration.** Cool, niche, defer.
- **Custom report builders.** The day sheet PDF is enough.
- **A web-based stage plot editor.** Read-only consumption of imported plots is fine for v1.

Every one of these will tempt you. Every one of these has killed an indie SaaS launch. Stay narrow.

---

## 10. The rider experiment — what to do with the Spanish sample

Once you upload the rider PDF, the experiment looks like this:

### Experiment goal

Validate that Claude can extract structured data from a real-world Spanish-language rider with high enough accuracy that a TM would trust it.

### Procedure

1. **Manual baseline first.** Open the rider. Note down: how many sections does it have? How many channels in the input list? How many people on the local labor call? What's the load-in time?
2. **Section classifier.** Run the classifier prompt above. See which sections it identifies. Verify against the manual scan.
3. **Input list extraction.** Run the input list extractor on the relevant pages. Compare:
   - Channel count: did it get the same number?
   - Channel sources: did it parse "Bombo" → "Kick" correctly in translation?
   - Mic specs: did it preserve "Shure Beta 91A" verbatim?
4. **Local labor call extraction.** Same comparison.
5. **Stage plot vision.** Render the stage plot page as PNG, send through vision extraction. Score: how many band positions did it identify correctly?
6. **Build a grading rubric.** For each section type, rate the extraction: percent of fields correct, percent of fields needing manual fix, percent missing entirely. Track this across multiple riders to know where the pipeline is solid and where it needs human review.

### Success thresholds

- **Input list:** 95%+ field accuracy. This is structured data; the bar is high.
- **Local labor:** 90%+ accuracy.
- **Schedule:** 95%+ accuracy.
- **Stage plot:** 70%+ position accuracy is fine — humans will fix the rest.
- **Hospitality / parking / free-text sections:** 80%+ accuracy on key facts (towel count, parking notes). Treat the rest as searchable but unstructured.

If any structured section is below threshold consistently, you have two choices: better prompt, or constrain the section to a tighter schema with more examples in the system prompt.

### When you upload the rider

Drop the PDF and I'll:

1. Read it in Spanish, summarize what's in it
2. Translate each section to English
3. Show what the extracted structured data would look like for the most automatable sections (input list, local labor, schedule)
4. Flag which sections will need a human in the loop
5. Note any structural quirks that would affect the parser design

That becomes your test fixture — the first rider in the test suite, the one you'll re-run as you tune the pipeline.

---

## 11. Open questions to resolve before you start

Things you'll need to decide that I can't decide for you:

- **Single-tenant first, or multi-tenant from the start?** Single-tenant is faster to ship. Multi-tenant means you can onboard the second TM in a day instead of a week. Recommendation: build with multi-tenancy in mind (every query scoped by `organization_id`), but launch with just one org.
- **Open source any of it?** The visibility-resolver code could be a small open-source library that builds credibility in the live-events tech community. The hub itself stays proprietary.
- **Pricing model when you launch?** Master Tour charges ~$50/admin/mo. Daysheets is similar. You can undercut, or you can match price and compete on features. Don't decide this until you have a paying user.
- **Distribution?** Tour managers are a small, tight community. Wins come from word-of-mouth (one TM tells another). Cold sales doesn't work in this market. Plan to do free pilots for the first 3–5 customers and let them be your salespeople.

---

## Appendix A — Useful libraries to consider

- **react-pdf** or **Puppeteer** for day sheet PDF generation
- **dnd-kit** for any drag-and-drop (CSV column mapping, stage plot positioning)
- **react-aria** or **shadcn/ui** for accessible components
- **zod** for runtime validation of structured-output responses
- **TanStack Query** for data fetching and cache
- **dayjs** or **date-fns** for timezone handling (touring crosses many)
- **opentype.js** if you build the stage plot editor with custom rendering
- **@anthropic-ai/sdk** the official Anthropic API client for Node

## Appendix B — Reference materials

- Master Tour public docs: https://www.eventric.com/
- Daysheets help center: https://www.daysheets.com/docs/
- Showvella (rider versioning reference): https://www.showvella.com/
- Anthropic structured output guide: https://docs.claude.com/en/docs/build-with-claude/structured-outputs
- Postgres row-level security: https://www.postgresql.org/docs/current/ddl-rowsecurity.html

---

*This is a living doc. Update it as the build progresses and the assumptions shift.*
