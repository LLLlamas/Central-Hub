# Claude Code Handoff: Rider Parsing Pipeline

**Project:** Tour Ops Hub — central tour management webapp
**Current focus:** Build the AI rider parsing pipeline (the wedge feature)
**Test fixture:** Real Spanish-language rider — `RIDER_ELSA_Y_ELMAR_2025_-FULL_BAND_-_Venue_Shows_030725.pdf`

---

## Read this first

This handoff is for the developer (you, Claude Code) actively building the webapp. Background context lives in two companion docs in this repo:

- `tour-research-v3.html` — full research on the touring industry, competitors, and information architecture
- `potential-implementation.md` — the full implementation playbook (data model, build order, tech stack)

**Don't re-read those unless you need context.** This handoff has everything actionable.

---

## What you're building right now

The **rider PDF parsing pipeline**. Drop a rider PDF into the app, AI extracts structured data, user reviews side-by-side, approves, data lands in the database.

This is the differentiator nobody else in the category has. Master Tour and Daysheets both treat riders as flat file attachments. Daysheets has AI for flight PDFs only.

### Why this feature first

It's the wedge. A tour manager who sees their 27-page rider parsed into structured data in 30 seconds will switch from Master Tour the same day. Everything else (calendar, day sheets, settlement) is table stakes — this is the demo that wins users.

---

## The test fixture (read this carefully)

`RIDER_ELSA_Y_ELMAR_2025_-FULL_BAND_-_Venue_Shows_030725.pdf` is a real production rider for Latin pop artist Elsa y Elmar's 2025 Full Band tour. It's 27 pages, primarily in Spanish with English technical terms.

### What's in it (14 numbered sections)

1. **Intro** — boilerplate preamble
2. **Notas** — production control clauses (boilerplate)
3. **Permisos** — permits/licenses clause (boilerplate)
4. **Soporte, Escenario** — stage build specs + power/generators
5. **Especificaciones Técnicas** — PA system + monitors + RF
6. **Input-Output** — 44-channel input list + monitor mix + FOH outputs ⭐ **highest-value section**
7. **Stage Plot** — visual diagram of band positions
8. **Iluminación y Lightplot** — lighting equipment list + 8 CAD pages
9. **Backline** — drums/bass/guitar/misc with brand specs
10. **Soundcheck** — 6 hours required closed-door
11. **Transportación** — ground (2 vans + 1 cargo) + air (8 tickets)
12. **Hospedaje** — 10-room rooming list with named occupants ⭐ **reveals roster**
13. **Camerinos** — 3 dressing rooms with detailed inventory
14. **Catering** — 7 different menus by time/room

### Key personnel revealed by the rider (cross-reference target)

The rider mentions the band members across sections — your cross-reference resolver should link these automatically:

- **Elsa Carvajal** — artist, vocals (sections 6, 12)
- **Julian Bernal** — guitar (sections 6, 12)
- **Juan** — drums (section 6 monitor mix only — last name not in rider)
- **Daniel** — bass (section 6 monitor mix only — last name not in rider)
- **Manuel González** — Production Manager (cover page) — `magcs81@gmail.com`, `+52 55 54 74 70 48`

### Quirks this rider reveals (the parser must handle these)

1. **Mixed languages.** Spanish prose + English technical terms. Don't translate "FOH" or "Mojo type barricade" or mic model numbers. Only translate instructional prose.
2. **Internal contradictions.** Section 4 says "2 generators, 1800 amps." Section 8 says "3 generators: 200kVA + 150kVA + 200kVA." The parser must surface this conflict, not silently resolve it.
3. **Typos in source data.** Channels 26 and 27 are both labeled "GTR L" (likely should be "GTR L" + "GTR R"). Channel 24 has a DI assigned but no source name. Flag these for human review.
4. **Negative constraints.** "NOT Yamaha hi-hat stand," "NOT motorcycle seat," "no Sol or Corona beer," "no roses or sunflowers." These exclusions are as important as positive specs. Schema must capture `exclude: []` alongside `preferred: []`.
5. **Brand alternates.** "Supraphonic, Black Magic, or similar" / "L-Acoustics, Meyer Sound, JBL VTX V." Schema needs `preferred_brands: []` with `substitution_allowed: bool`.
6. **Time-of-day catering variants.** Same dressing room has different menus for load-in / soundcheck / show / post-show. Schema must include `menu_time` enum.
7. **Cover page version warning.** Page 1 says "FAVOR OMITIR VERSIONES ANTERIORES" ("please ignore previous versions"). This is the version-drift problem the hub solves with live links. Keep the original PDF + revision number always attached.

---

## Build order for this pipeline

Build in this exact order. Each step unblocks the next.

### Step 1 — Section classifier (do first)

The cheapest API call. Identifies which sections are present and on which pages.

**Endpoint:** `POST /api/ingest/rider/classify`

**Input:** PDF file (base64 or multipart upload)

**Anthropic call:**

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 2048,
  messages: [{
    role: "user",
    content: [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: pdfBase64 }
      },
      {
        type: "text",
        text: `You will be shown a touring artist's rider document. The rider may be
in any language. List which of the following sections are present, with page
numbers for each. Return ONLY valid JSON matching this schema, no other text:

{
  "language_detected": "es|en|pt|fr|de|other",
  "artist_name": "string",
  "revision_info": { "version": "string|null", "date": "string|null" },
  "production_manager": {
    "name": "string|null",
    "email": "string|null",
    "phone": "string|null"
  },
  "sections": [
    {
      "type": "cover_and_contacts|production_control|permits|stage_specs|audio_pa|audio_monitors|input_list|output_patch|stage_plot|lighting_equipment|lighting_plot|backline|video|soundcheck|ground_transport|air_transport|lodging|dressing_rooms|catering|settlement|other",
      "pages": [int],
      "confidence": 0.0-1.0
    }
  ]
}`
      }
    ]
  }]
});
```

**Success criteria:** running this against the Elsa y Elmar test fixture should:

- Detect `language_detected: "es"`
- Extract `artist_name: "Elsa y Elmar"`
- Extract `revision_info.date: "septiembre 2025"` (or "September 2025" — either is fine)
- Extract `production_manager: { name: "Manuel González", email: "magcs81@gmail.com", phone: "+52 55 54 74 70 48" }`
- Identify all 14+ sections with at least 90% accuracy on page numbers
- Flag the lighting CAD pages as `lighting_plot` separate from `lighting_equipment`

### Step 2 — Input list extractor (highest-value section)

Most structured section in any rider. If this works well, the whole pipeline works.

**Endpoint:** `POST /api/ingest/rider/extract/input-list`

**Schema (use this exact shape for the structured output):**

```typescript
type InputListExtraction = {
  total_channels: number;
  channels: Array<{
    channel_number: number;
    source: string;                    // verbatim from rider
    source_en: string | null;          // English translation if source != English
    mic_or_di: string;                 // verbatim, never translate model numbers
    stand_type: 'boom' | 'short_boom' | 'tall_boom' | 'mini_boom' | 'straight' | 'clamp' | 'none' | 'other';
    stand_notes: string | null;
    phantom_48v: boolean | null;
    insert_outboard: string | null;
    sub_snake: string | null;
    wireless: boolean;
    wireless_system: string | null;    // e.g. "EW-DX" if specified
    notes: string | null;
    extraction_flags: Array<{
      level: 'warning' | 'error';
      message: string;
    }>;
  }>;
  monitor_outputs: Array<{
    outputs: string;                   // e.g. "1-2" or "3 & 4"
    mix_name: string;                  // e.g. "MAIN - ELSA"
    person_name: string | null;        // e.g. "ELSA" if parseable
    type: 'in_ear_stereo' | 'in_ear_mono' | 'wedge' | 'side_fill' | 'drum_fill' | 'other';
    bodypack_count: number | null;
    notes: string | null;
  }>;
  foh_outputs: Array<{
    output_number: string;
    source: string;
    notes: string | null;
  }>;
  document_warnings: string[];         // top-level issues like missing channels, duplicates
};
```

**Anthropic call:**

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 4096,
  messages: [{
    role: "user",
    content: [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: pdfBase64 }
      },
      {
        type: "text",
        text: `Extract the input list, monitor output mix, and FOH output patch from this rider.

CRITICAL RULES:
1. Never translate or alter microphone or DI model numbers. "e901" stays "e901". "Radial PRO DI" stays "Radial PRO DI".
2. For source names, preserve the original language verbatim in 'source', and provide an English translation in 'source_en' only if the source isn't already English.
3. If a channel has missing data (e.g. blank source), include it with the data you can find and add an extraction_flag with level='warning'.
4. If you see duplicate or suspicious channels (e.g. two channels labeled identically), add an extraction_flag noting the likely typo.
5. Return ONLY valid JSON matching the schema, no markdown fences, no other text.

Schema:
${JSON.stringify(InputListSchemaJSON)}`
      }
    ]
  }]
});
```

**Success criteria against the test fixture:**

- Extract all 44 channels
- Correctly flag CH 24 as missing source (`extraction_flags`)
- Correctly flag CH 26 and CH 27 as duplicate "GTR L" labels (likely typo for L/R)
- Preserve all mic model numbers verbatim
- Detect 8 stereo monitor mixes with band member names parsed (Elsa, Juan, Daniel, Julian)
- Detect 8 FOH outputs with their assignments

### Step 3 — Personnel extraction + cross-reference (the magic moment)

Pull band/crew names from multiple sections and link them. This is the demo that wins users.

**Endpoint:** `POST /api/ingest/rider/extract/personnel`

**Schema:**

```typescript
type PersonnelExtraction = {
  people: Array<{
    name_full: string | null;          // "Elsa Carvajal"
    name_short: string | null;         // "Elsa" — for cross-ref
    role: string;                      // "artist" | "guitarist" | "drummer" | "bassist" | "production_manager" | "tour_manager" | "audio_engineer" | "lighting_engineer" | "vj" | "makeup" | "staff" | "other"
    department: 'leadership' | 'technical' | 'support' | 'talent' | 'business' | null;
    contact: {
      email: string | null;
      phone: string | null;
    } | null;
    sourced_from_sections: string[];   // which rider sections mention them
    notes: string | null;
  }>;
  party_size_total: number;
  flight_tickets_required: number;
  hotel_rooms_required: number;
};
```

**Sources to scan:**

- Cover page (Production Manager)
- Section 6 monitor outputs (band members by first name)
- Section 12 rooming list (full names where given, role labels for unnamed)
- Anywhere else names appear

**Success criteria against the test fixture:**

- Detect at minimum: Elsa Carvajal (artist), Julian Bernal (guitarist), Juan (drummer — no last name), Daniel (bassist — no last name), Manuel González (production manager)
- Detect all 11 touring party members from the rooming list, even where names are missing (use role as placeholder)
- Correctly populate `flight_tickets_required: 8` and `hotel_rooms_required: 10` from sections 11 and 12

### Step 4 — Backline extractor

```typescript
type BacklineExtraction = {
  drums: {
    kit_options: string[];             // ["Gretsch Classic Maple", "DW Collectors", "Yamaha Hybrid Maple"]
    pieces: Array<{
      type: string;                    // "kick" | "rack_tom" | "floor_tom" | "snare"
      size: string;                    // "22\"" | "13\"" | "14x6"
      notes: string | null;            // "main", "spare", "with legs"
    }>;
    hardware: Array<{
      item: string;
      qty: number;
      preferred: string[];
      excluded: string[];              // CRITICAL: "no Yamaha", "no motorcycle seat"
      notes: string | null;
    }>;
  };
  bass: {
    options: Array<{
      option_number: number;
      head: string;
      cab: string;
    }>;
  };
  guitar: Array<{
    item: string;
    qty: number;
    notes: string | null;
  }>;
  miscellaneous: Array<{
    item: string;
    qty: number;
    brand_preferred: string | null;
    notes: string | null;
  }>;
  risers_required: boolean;
  video_screen: {
    type: string;
    dimensions: string;
    aspect_ratio: string;
    resolution_preferred: string;
    resolution_min: string;
  } | null;
};
```

**Critical test against the fixture:**

- Drum hardware must capture `excluded: ["Yamaha"]` for the hi-hat stand
- Drum throne must capture `excluded: ["motorcycle_seat"]` and `notes: "62cm round seat, no backrest"`
- Bass section must show 3 options
- All 3 guitar amps must be detected (Twin Reverb + Hot Rod + Spare Twin Reverb)

### Step 5 — Lodging / rooming list extractor

Smallest schema, very high accuracy expected.

```typescript
type LodgingExtraction = {
  hotel_requirements: {
    star_rating: number | null;
    chain_only: boolean;
    amenities_required: string[];      // ["24h_room_service", "breakfast", "wifi"]
    artist_pre_approval: boolean;
  };
  rooming_list: Array<{
    room_number: number;
    room_type: 'single' | 'double' | 'junior_suite' | 'suite' | 'twin';
    occupants: Array<{
      name: string | null;
      role: string;                    // "artist", "guitarist", etc.
    }>;
  }>;
  total_rooms: number;
  total_occupants: number;
};
```

### Step 6 — Stage plot extractor (vision)

Send the stage plot page as image, not via document API.

**Endpoint:** `POST /api/ingest/rider/extract/stage-plot`

```typescript
type StagePlotExtraction = {
  performer_positions: Array<{
    label: string;                     // "Elsa - Vox", "Drums"
    name: string | null;
    zone: 'upstage_left' | 'upstage_center' | 'upstage_right' |
          'midstage_left' | 'midstage_center' | 'midstage_right' |
          'downstage_left' | 'downstage_center' | 'downstage_right';
    channels_referenced: string[];     // ["CH 1-12", "CH 38"]
    instrument: string | null;
  }>;
  power_drops_count: number;
  snake_locations: string[];
  off_stage_wireless: string[];
  confidence_overall: number;          // 0.0-1.0; stage plots are harder
};
```

**Note:** confidence will be lower (~70-80%). That's expected. UI lets human drag/correct.

### Step 7 — Catering extractor (multi-menu)

The longest section. Each room has multiple menus by time-of-day.

```typescript
type CateringExtraction = {
  menus: Array<{
    room: string;                      // "Camerino 01 - Elsa", "Camerino 02 - Músicos", "Camerino 03 - Crew"
    menu_time: 'load_in' | 'soundcheck' | 'show' | 'post_show';
    available_by: string | null;       // "90 min before soundcheck"
    items: Array<{
      item: string;                    // verbatim
      item_en: string | null;          // English translation
      qty: number | string;            // "8" or "assorted"
      unit: string | null;             // "ml", "g", "bottles"
      brand_preferred: string[];
      brand_excluded: string[];
      notes: string | null;
      dietary_tags: string[];          // ["no_sugar", "vegetarian", "biodegradable"]
    }>;
  }>;
  general_requirements: {
    biodegradable_disposables: boolean;
    food_donation_plan_required: boolean;
    other: string[];
  };
};
```

**Critical test against fixture:**

- Detect all 7 menus (3 rooms × ~2 menu times each)
- Capture `brand_excluded: ["Sol", "Corona"]` for musician's beer
- Capture `brand_excluded: ["rose", "sunflower"]` if it ends up in dressing room flowers (currently lives in section 13, not catering — but include in dressing room extractor)
- Capture all quantities with units

### Step 8 — Conflict detector

Runs after all section extractors complete. Looks for contradictions.

**Endpoint:** `POST /api/ingest/rider/detect-conflicts`

**Input:** the assembled extracted data from all sections.

```typescript
type ConflictReport = {
  conflicts: Array<{
    type: 'numeric_disagreement' | 'missing_reference' | 'count_mismatch' | 'duplicate' | 'other';
    severity: 'low' | 'medium' | 'high';
    description: string;
    sections_involved: string[];
    values: Array<{ section: string; value: any }>;
    suggested_resolution: string | null;
  }>;
};
```

**Critical test against fixture:**

- Detect generator/power conflict between section 4 ("2 generators, 1800 amps") and section 8 ("3 generators 200/150/200 kVA")
- Detect the CH 24 missing source
- Detect CH 26/27 likely duplicate
- Detect that the rooming list has 10 rooms for 11 people (correctly resolved as 2 doubles, but flag if anything's off)

---

## Tech stack to use

Match what's already in the webapp. Likely:

- **Backend:** Node + Express (or Hono if already in place)
- **Anthropic SDK:** `@anthropic-ai/sdk` — official
- **File storage:** whatever's set up for uploads (R2 / S3)
- **Database:** Postgres — store extracted JSON in `jsonb` columns on a `rider_revisions` table
- **Frontend:** React + Vite, with side-by-side review UI

If something isn't set up, ask before adding new dependencies.

---

## File structure

Create or use these locations:

```
apps/api/src/ingest/rider/
├── classify.ts              # Step 1
├── extract-input-list.ts    # Step 2
├── extract-personnel.ts     # Step 3
├── extract-backline.ts      # Step 4
├── extract-lodging.ts       # Step 5
├── extract-stage-plot.ts    # Step 6
├── extract-catering.ts      # Step 7
├── detect-conflicts.ts      # Step 8
├── schemas/
│   ├── input-list.ts        # Zod schema for runtime validation
│   ├── personnel.ts
│   ├── backline.ts
│   ├── lodging.ts
│   ├── stage-plot.ts
│   ├── catering.ts
│   └── classifier.ts
├── prompts/
│   ├── classify.md          # The exact prompt text
│   ├── input-list.md
│   └── ...                  # one per extractor
└── index.ts                 # Orchestrator: takes a PDF, returns full extraction

apps/api/test/ingest/rider/
├── elsa-y-elmar-2025.test.ts  # Test against the fixture
├── fixtures/
│   └── RIDER_ELSA_Y_ELMAR_2025.pdf  # Copy of the test rider
└── expected/
    ├── classifier.json      # Expected classifier output
    ├── input-list.json      # Expected input list (44 channels)
    └── ...                  # Expected output per extractor
```

Each extractor is a function with the signature:

```typescript
export async function extractInputList(
  pdfBase64: string,
  context: { language?: string; }
): Promise<InputListExtraction> { ... }
```

---

## Test harness

Build a single test that runs all extractors against the Elsa y Elmar fixture and prints a graded report:

```bash
npm run test:rider-fixture
```

Output should look like:

```
RIDER PARSING TEST — Elsa y Elmar 2025
========================================

Step 1 — Classifier ......................... PASS (14/14 sections, language=es)
Step 2 — Input List ......................... PASS (44/44 channels, 2 warnings flagged correctly)
Step 3 — Personnel .......................... PASS (5 people detected, 11 party members)
Step 4 — Backline ........................... PASS (3 drum kit options, 2 negative constraints captured)
Step 5 — Lodging ............................ PASS (10 rooms, 11 occupants)
Step 6 — Stage Plot ......................... PARTIAL (4/4 zones, confidence 0.78)
Step 7 — Catering ........................... PASS (7 menus extracted)
Step 8 — Conflict Detector .................. PASS (3 conflicts detected, matches expected)

Overall: 7 PASS, 1 PARTIAL, 0 FAIL
Total tokens: ~XX,XXX
Total cost: $X.XX
```

This harness becomes your regression suite. Every prompt change, re-run it.

---

## What NOT to do in this pass

- **Don't build the review UI yet.** Get the API extractors solid first. The UI comes after the data shape is proven.
- **Don't try to parse the lighting CAD pages.** Store them as attached references; v1 doesn't extract structure from them.
- **Don't translate technical terms.** Mic models, console names, brand names, console outputs all stay verbatim.
- **Don't auto-resolve conflicts.** Flag them. Always.
- **Don't pull in heavy parsing libraries.** Anthropic's document API handles PDFs natively. No `pdf-parse` or `pdf-lib` needed for v1.
- **Don't add other rider tests until this one passes.** One fixture, deeply tested, beats five fixtures shallowly tested.

---

## Acceptance criteria for this handoff

Done when:

1. ✅ All 8 extractor endpoints exist and accept a PDF
2. ✅ Each extractor returns valid JSON matching its Zod schema
3. ✅ Test harness runs and the Elsa y Elmar fixture passes all 8 steps
4. ✅ Conflict detector catches the generator/power mismatch
5. ✅ Negative constraints (no Yamaha, no motorcycle seat) are preserved in backline output
6. ✅ Cross-references work: Juan/Daniel/Julian linked to roles via monitor outputs + rooming list
7. ✅ Total cost per rider parse is under $0.50 in API tokens (sanity check)
8. ✅ Original PDF stored, revision number captured, "FAVOR OMITIR VERSIONES ANTERIORES" surfaced as a top-level warning

---

## After this works

Next features in order:

1. **Side-by-side review UI** — source PDF on left, extracted JSON on right with inline edit
2. **Apply extracted data to Show records** — populate the database from approved extractions
3. **Live link per show** — public URL that always serves the current rider revision
4. **Second test rider** — add an English-language rider to prove the pipeline generalizes
5. **Stage plot drag-correct UI** — let human nudge positions the vision model got wrong

Don't start any of these until step 1-8 above are green.

---

## Questions to escalate, not assume

If you hit any of these, stop and ask the user before continuing:

- API key for Anthropic isn't set up — where should it live?
- The webapp doesn't yet have a database — should you scaffold one or wait?
- The webapp doesn't yet have file uploads — should you scaffold or stub?
- A new dependency is needed that costs money or has security implications
- The fixture rider's expected output JSON files don't exist — you'll need to generate them by running the extractors once and hand-verifying

---

## Reference: full section-by-section translation of the test rider

For convenience, here's what each section contains in English. Use this to verify your extractors are getting the right things.

**Page 1 (cover):**
- Title: "TECH RIDER | Full Band 2025"
- Updated: September 2025
- Warning: "PLEASE IGNORE PREVIOUS VERSIONS"
- Production Manager: Manuel Gonzalez, +52 55 54 74 70 48, magcs81@gmail.com

**Section 4 stage specs:**
- Ground support: 12m × 9m × 10m, covered
- Stage: 14m × 10m at 1.50m height
- Work areas: 3.66m × 10m SL, 4.88m × 6.10m SR
- 6 fans (1 guitar, 1 bass, 1 drums, 3 front)
- Black or grey, smooth, level
- 3 staircases (upstage center, SL, SR)
- HEAVY Mojo-type barricade
- No risers
- 2 generators minimum, 1800A across 3 phases at 110-125V/60Hz
- Ambulance from load-in to load-out

**Section 5 audio:**
- 4-way stereo PA, 105-110 dB(C), min 110dB SPL
- ±3dB from 25Hz-18kHz, 120dB headroom
- L+R+Subs+Frontfill (NOT mono)
- Brand options: L-Acoustics / Meyer / JBL VTX V
- Specific: D&B J8/J · L'Acoustics V-DOSC/SB218 · Adamson Y18/T21 · Nexo GEOD/CD18
- Front fill 4-6 cabs same brand
- FOH centered, ground level preferred, max 50cm riser, max 30m from stage, covered with tent, intercom to monitors
- Tour brings own console. Alternates: Yamaha CL5 / Avid S6L 32d / Waves LV1 (48ch)
- Monitors: 8× Shure PSM 1000 IEM + 6 extra bodypacks, 8× SE215, 2× 8ch combiners, 2× helical antennas
- Wireless mics tour-provided: 2× Sennheiser EW300 G4, main+spare vocal Sennheiser 470-558 MHz
- RF tech required load-in to end of show
- Local provides: 2× 96m Cat 6 cables FOH → SL

**Section 6 input list (44 channels — see fixture for full table, transcribed key channels):**
- CH 1: Kick In, Sennheiser e901
- CH 2: Kick Out, e902, Mini Boom
- CH 3-6: Snares (top/bot × 2), e906/e904
- CH 7: Hi-Hat, e914, Tall Boom
- CH 8-10: Toms, e904, Clamp
- CH 11-12: Overheads, e914, Tall Boom
- CH 13-14: Roland SPD L/R, Radial PRO DI
- CH 15-22: Playaudio playback (Perc/Arm/BGV L/R, SMPTE, Click)
- CH 23: Moog, Radial PRO DI
- CH 24: (missing source), Radial PRO DI ⚠ flag
- CH 25: BASS, Radial PRO DI
- CH 26-27: GTR L (both labeled L) ⚠ flag — likely L/R
- CH 28-29: Mini Juno L/R
- CH 30-31: Nord L/R
- CH 32: Acoustic GTR Elsa, Radial PRO RMP + PRO DI, Wireless EW-DX
- CH 33: Electric GTR Elsa, Wireless EW-DX
- CH 34: Vox Main ELSA, Sennheiser EW 500 G4 + 935, Wireless, Straight Stand
- CH 35: Vox SPARE
- CH 36: Vox JULIAN (gtr), e935
- CH 37-44: Talkbacks (Elsa, Drums, Bass, GTR, Stage L, Stage R, PROD, Local FOH 1)

**Section 6 monitor mix (8 stereo mixes):**
1. MAIN - ELSA
2. DRUM - JUAN
3. BASS - DANIEL
4. GUITAR - JULIAN
5. SPARE
6. STAFF (4 bodypacks)
7. GUEST
8. CUE

**Section 6 FOH outputs:**
- FOH 1: SMPTE to Lighting & Video
- FOH 2: Talkback speaker
- FOH 3-4: Light & Video mix (wireless stereo in-ear, 2 bodypacks)
- FOH 5-6: Main LR
- FOH 7: Sub
- FOH 8: Front Fill

**Section 8 lighting equipment:**
- 43× Robe MegaPointe
- 10× Color Strike M
- 61× Elation Chorus Line 16
- 8× Robe Spider
- 18× 1-ton hoist motors
- Truss: 8× Tomcat LD 12×12 10ft, 4× GT Tyler 10ft, 2× sideboom 1.5m, 2× sideboom 1m
- 2× GrandMA 3 Full Size
- 6× AM Haze Stadium or DF-50
- 2× Low Fog Machine

**Section 8 power (CONFLICTS WITH SECTION 4):**
- 3 generators: Audio/Video 200kVA, Lighting 150kVA, Spare 200kVA
- 3 phases, neutral, ground (2m rod) per generator
- Cam-Lock connections
- Edison 110-127V at stage

**Section 9 backline:**
- Drums: Gretsch Classic Maple / DW Collectors / Yamaha Hybrid Maple
- Kick 22", Rack 13", Floors 16" + 18" w/ legs
- Main snare 14×6 or 14×8 (Supraphonic, Black Magic, or similar)
- Snare 2: 14×6 Maple (Gretsch Brooklyn USA or similar)
- Snare spare: 14×6
- 3× snare stands, 4× cymbal booms
- 1× DW 5000 hi-hat stand or similar, **NOT Yamaha**
- 1× kick pedal, 1× rug, Remo Ambassador Coated heads
- 1× DW Airlift 9000 throne, no backrest, round seat 62cm, **NOT motorcycle seat**
- Bass options: (1) Ampeg SVT-Classic + Ampeg 8×10 / (2) Aguilar Tone Hammer 700 + DB 810 / (3) Aguilar DB 751 + DB 810
- Guitar: 1× Fender Twin Reverb 2×12, 1× Hot Rod 2×12, 1× Spare Fender Twin Reverb 2×12
- Misc: 4× Hercules keyboard stands, 6× Hercules instrument stands, 2× 7-space guitar rack, 6× percussion tables, 6× 1/4" 17ft cables
- No risers
- Video: 1× LED screen pitch 3.9, 12×5m, 16:9, 1920×1080 preferred (1280×720 acceptable), pixel map required

**Section 10 soundcheck:**
- Closed door
- 6 hours minimum from load-in

**Section 11 transport:**
- Ground: 2× Sprinter 20-pax vans + 1× cargo van, min 2020 model
- Air: trips > 5h require flying. 8 tickets total: 2 AM Plus (front row economy, seated together) + 6 economy. All with 25kg bag, 2 passengers get 2 bags. Direct flights preferred. TM approval required.

**Section 12 lodging (10 rooms / 11 people):**
- Junior Suite: Elsa Carvajal
- Single: Julian Bernal
- Single: Production Manager (Manuel González)
- Single: Tour Manager
- Single: Bassist (Daniel)
- Single: Drummer (Juan)
- Single: MUA + Personal
- Single: Audio Engineer
- Double: Staff + Staff (2 people)
- Double: VJ + Lighting Engineer (2 people)

**Section 13 dressing rooms:**
- 3 rooms, 5m × 5m minimum, lockable, smoke-free, ventilated, sanitized
- Camerino 01 (Elsa): private bathroom, 2 couches, 4 chairs, full mirror, coat rack, 2 floor lamps warm light, catering table, 4 black face towels, multi-outlet w/ iPhone+Android chargers + 6× 110V, cooler, flower vase (carnations or lilies — **NO roses or sunflowers**), unlit scented candle, trash can
- Camerino 02 (musicians): private bathroom, 2 couches, 4 chairs, mirror, coat rack, 1 floor lamp, catering table, 8 black face towels, multi-outlet same as above, cooler, trash can
- Camerino 03 (crew): 2 couches, work table, 6 chairs, catering table, floor lamp, multi-outlet same as above, cooler, trash can

**Section 14 catering (7 menus — see fixture for full lists):**
- Crew @ Load-In: water (still + sparkling), coffee station, sodas, Red Bull, Gatorade, Electrolit, apples, bananas, Nature Valley bars, mixed berries, snacks, mixed nuts, 8 black face towels, ice
- Elsa @ Soundcheck (90 min before): 8× Santa María water, 8× sparkling, 8× Gatorade/Electrolit, tea (black + ginger), coffee (regular + decaf), French press, kettle, fresh ginger, 8 lemons, creamer, almond milk no sugar, Greek yogurt no sugar, berries, charcuterie tray, nuts, granola bars, chips, Slim Pop popcorn (cheddar/natural/sweet)
- Musicians @ Soundcheck: same as crew load-in plus extras
- Elsa @ Show: full soundcheck list + chocolate (Valor/Lindt 70% dark), vegetable chips, gummy bowl, Tylenol, knife + cutting board, **small balloons (medium or small)**, regional Mexican dishes (vegetarian options, confirm with TM)
- Musicians @ Show: 16× Santa María water, 16× Topo Chico sparkling, 10× sports drinks, 6× Coke, 6× Coke Zero, lemons, bananas, chips, charcuterie tray, almonds, pistachios, electric kettle, knife + cutting board, biodegradable cups, cooler
- Crew @ Show: 16× water, sodas, sparkling, vitamin water, Gatorade, sandwich station (whole grain bread, ham, turkey ham, manchego, panela, tomato/onion/avocado, mayo, mustard, chipotle, jalapeño, electric sandwich press), ice, biodegradable disposables, sanitizer
- Post-show Elsa: clear soup, grilled meat/chicken with vegetables, sea salt
- Post-show musicians: 1 bottle white or rosé wine, 15 cold beers (NOT Sol, NOT Corona), 2 bottles Mezcal (Amaras / Unión / 400 Conejos — outside Mexico, local equivalents), regional dishes with vegetarian options
- Post-show crew: 10 cold beers (NOT Sol, NOT Corona), 2 salads (confirm with TM), regional dishes with vegetarian options
- Footer note: plan for leftover food donation to local charity or venue staff

---

*End of handoff. Update this file as the implementation progresses. Add new fixtures and expected outputs to the test suite as they're verified.*
