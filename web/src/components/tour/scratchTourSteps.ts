// Step data for the Start From Scratch coach-mark walkthrough.
// Short, warm copy - a mix of spotlit action steps and centered feature beats.

import type { Tour } from '@/types';

export interface TourStep {
  id: string;
  /** Route this step lives on - the tour navigates here when the step opens. */
  route: string;
  /** `data-tour` anchor to spotlight; omit for a centered bubble. */
  target?: string;
  title: string;
  body: string;
  /** When this predicate turns true the tour auto-advances (a hands-on step). */
  advanceWhen?: (tour: Tour) => boolean;
}

export const scratchTourSteps: TourStep[] = [
  // --- Intro ---
  {
    id: 'welcome',
    route: '/',
    title: "Welcome — you're the Tour Manager",
    body: "Elsa y Elmar are hitting the road. Four docs have landed in your inbox: a route, a tech rider, flight confirmations, and hotel bookings. Let's build the tour from them.",
  },

  // --- Import steps (4 hands-on uploads) ---
  {
    id: 'route',
    route: '/ingest/flights',
    target: 'route-dropzone',
    title: 'Step 1 — Drop the route',
    body: "Drop the routing CSV here. It lays down every date, marks show vs. travel vs. off days, and seeds each day's schedule skeleton.",
    advanceWhen: (t) => t.days.length > 0,
  },
  {
    id: 'rider',
    route: '/ingest/riders',
    target: 'rider-dropzone',
    title: 'Step 2 — Drop the rider',
    body: "Your calendar's live. Now drop the rider PDF — Spanish or English. The parser reads its table of contents, extracts the input list and tech specs, and adds the band and crew to your roster.",
    advanceWhen: (t) => t.riderImports.length > 0,
  },
  {
    id: 'rider-review',
    route: '/ingest/riders',
    target: 'rider-sections',
    title: 'Review what the parser pulled',
    body: 'Each section opens a side-by-side: source PDF on the left, extracted text on the right — including stage and lighting plots. Read across, fix anything wrong, then Approve. Done sections stack at the top so the rail shows only what remains.',
  },
  {
    id: 'flight',
    route: '/ingest/flights',
    target: 'travel-grid-dropzone',
    title: 'Step 3 — Import flights',
    body: "Drop the travel agent's grid (CSV — every passenger × leg in one file) for a bulk import, or drop individual boarding pass PDFs. Both feed the same review queue.",
    advanceWhen: (t) => t.flightImports.length > 0,
  },
  {
    id: 'flight-approve',
    route: '/ingest/flights',
    target: 'flight-approve',
    title: 'Approve & commit',
    body: 'Check the passenger matches: fix a typo in a name (pencil on hover), remove a parser-junk row (✕), or click "Resolve" to assign / add / skip. Then Approve — that commits the flights as Travel on each day. Re-upload anytime to fix seat changes or add passengers.',
    advanceWhen: (t) => t.travel.length > 0,
  },
  {
    id: 'hotel',
    route: '/ingest/flights',
    target: 'hotel-dropzone',
    title: 'Step 4 — Drop the hotels',
    body: 'One PDF per property, or all at once. Each hotel lands on its check-in day, guests are matched to your roster, and the hotel-advance task list is seeded.',
    advanceWhen: (t) => t.hotels.length > 0,
  },

  // --- Feature beats (centered, no spotlight) ---
  {
    id: 'today',
    route: '/',
    title: 'Today — your operational home',
    body: "The app opens here every session. Today's show clock, travel, and hotel all in one place — lock the day or jump straight to the day sheet from here.",
  },
  {
    id: 'calendar',
    route: '/calendar',
    title: 'The full tour at a glance',
    body: 'Every day colour-coded by type — show, travel, off. Switch between list and grid, or tap any day to open it.',
  },
  {
    id: 'daysheet',
    route: '/daysheet',
    title: 'The Day Sheet',
    body: "The run-of-day, ready to print or share. Switch to Edit to fix call times, add or remove items, and save — changes land everywhere and note who made them. Lock the day from the tools rail when the plan is final.",
  },
  {
    id: 'gear',
    route: '/gear',
    title: 'Supplies & Costs',
    body: "Rider supplies, flights, and hotels — all pre-populated from your uploads. Click any cost cell to edit it inline; tick supply status through Needed → Sourced → Confirmed. The grand total rolls up across all three.",
  },
  {
    id: 'permissions',
    route: '/schedule',
    target: 'viewer-switcher',
    title: 'Who sees what',
    body: 'Set permissions by item type — one lobby call configures all of them. Then click this button to switch viewer and see the day sheet exactly as the FOH engineer or the artist sees it.',
  },
  {
    id: 'done',
    route: '/',
    title: "That's a working tour",
    body: 'Route, rider, flights, hotels — built from four files. Explore every surface freely, or Reset from the banner to start from scratch.',
  },
];
