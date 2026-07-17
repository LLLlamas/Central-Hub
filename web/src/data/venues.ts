/* ============================================================
 * Venue directory
 * ------------------------------------------------------------
 * The rider PDF never contains venue addresses or local promoter
 * contacts — those come from the booking agent's deal memos and
 * the PM's advance work with the venue's house production team.
 *
 * The static directory starts EMPTY: the app ships with no
 * fabricated venues, and every venue record arrives through
 * per-tour data — Ticketmaster seeding and route-CSV imports
 * write `Tour.venues` entries, and future user entry lands there
 * too. `getVenueForTour` prefers those per-tour records and only
 * falls back to this (currently empty) shared directory.
 * ============================================================
 */

import type { ID, Tour, Venue } from '@/types';

export const VENUE_DIRECTORY: Record<string, Venue> = {};

export function getVenue(venueId?: string): Venue | undefined {
  if (!venueId) return undefined;
  return VENUE_DIRECTORY[venueId];
}

/** Venue lookup for tour surfaces: prefers the tour's own per-tour
 *  records (`Tour.venues`), falling back to the shared directory
 *  (empty today) when the venueId isn't present there. */
export function getVenueForTour(tour: Tour, venueId?: ID): Venue | undefined {
  if (!venueId) return undefined;
  return tour.venues?.[venueId] ?? VENUE_DIRECTORY[venueId];
}
