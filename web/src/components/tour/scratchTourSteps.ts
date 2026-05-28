// Step data for the Start From Scratch coach-mark walkthrough.
// Mirrors the structure of the iOS app's llama-intro tour: short, warm copy,
// numbered steps, a mix of spotlit actions and centered transition beats.

import type { Tour } from '@/types';

export interface TourStep {
  id: string;
  /** Route this step lives on — the tour navigates here when the step opens. */
  route: string;
  /** `data-tour` anchor to spotlight; omit for a centered bubble. */
  target?: string;
  title: string;
  body: string;
  /** When this predicate turns true the tour auto-advances (a hands-on step). */
  advanceWhen?: (tour: Tour) => boolean;
}

export const scratchTourSteps: TourStep[] = [
  {
    id: 'welcome',
    route: '/',
    title: "Welcome — you're the new Tour Manager",
    body: 'Elsa y Elmar are about to tour. Four documents have landed in your inbox: a route from the booking agent, the band’s tech rider, flight confirmations, and a hotel block. Let’s turn them into a working tour.',
  },
  {
    id: 'route',
    route: '/ingest/flights',
    target: 'route-dropzone',
    title: 'Step 1 — Import the route',
    body: 'Drop the routing spreadsheet here. It builds a day for every date, sets show/travel/off days, and seeds each day’s schedule.',
    advanceWhen: (t) => t.days.length > 0,
  },
  {
    id: 'route-done',
    route: '/ingest/flights',
    title: 'Your tour calendar exists',
    body: 'Seven days, two shows, venues attached. The Calendar and Day Sheets are live now. Next: the rider.',
  },
  {
    id: 'rider',
    route: '/ingest/riders',
    target: 'rider-dropzone',
    title: 'Step 2 — Import the rider',
    body: 'Drop the rider PDF. The AI ingest reads every section — input list, backline, catering — and adds the band + crew to your roster.',
    advanceWhen: (t) => t.riderImports.length > 0,
  },
  {
    id: 'rider-review',
    route: '/ingest/riders',
    target: 'rider-sections',
    title: 'Review what the AI extracted',
    body: 'Each section can be corrected inline, then approved. Conflicts the rider contradicts itself on are flagged for your decision — never auto-resolved.',
  },
  {
    id: 'flight',
    route: '/ingest/flights',
    target: 'travel-grid-dropzone',
    title: 'Step 3 — Import the flights',
    body: 'Two ways in: drop the travel agent’s grid (CSV — every passenger × leg in one file) for a bulk import, or drop per-flight confirmation PDFs alongside it. Try the grid for the fast path.',
    advanceWhen: (t) => t.flightImports.length > 0,
  },
  {
    id: 'flight-approve',
    route: '/ingest/flights',
    target: 'flight-approve',
    title: 'Approve the parsed flight',
    body: 'Check the passenger matches look right, then Approve & import — that commits the flight as Travel on the right day.',
    advanceWhen: (t) => t.travel.length > 0,
  },
  {
    id: 'hotel',
    route: '/ingest/flights',
    target: 'hotel-dropzone',
    title: 'Step 4 — Import the hotels',
    body: 'Drop the hotel-block confirmation. It adds each hotel to its check-in day, matches the rooming list, and creates the hotel-advance tasks.',
    advanceWhen: (t) => t.hotels.length > 0,
  },
  {
    id: 'calendar',
    route: '/calendar',
    title: 'Your tour, day by day',
    body: 'The Calendar shows every day colour-coded by type — show, travel, rehearsal, off. Switch between list and grid, and tap any day to open it.',
  },
  {
    id: 'daysheet',
    route: '/daysheet',
    title: 'The Day Sheet',
    body: 'Each day has a printable run-of-day: schedule, travel, hotel, contacts. It’s what you’d hand the crew. Print or share it from here.',
  },
  {
    id: 'locking',
    route: '/daysheet',
    title: 'Lock a day when it’s final',
    body: 'Locking a day freezes its plan and stamps who closed it out — so a finished day can’t drift. Unlock it again any time from the day’s tools.',
  },
  {
    id: 'conflicts',
    route: '/ingest/riders',
    title: 'Conflicts wait for your call',
    body: 'When the rider contradicts itself, the hub flags it rather than guessing. Open a conflict, pick the right value, and it records who decided.',
  },
  {
    id: 'permissions',
    route: '/schedule',
    title: 'Who sees what',
    body: 'Schedule permissions are per-person. Switch viewer in the top bar to see the same day as the FOH engineer or the artist — same data, different views.',
  },
  {
    id: 'done',
    route: '/',
    title: "That's a tour, built from scratch",
    body: 'Route, rider, travel and hotels — all from four uploaded files. You’ve seen every surface; explore freely, or Reset from the banner to start over.',
  },
];
