/* ============================================================
 * SCRATCH TOUR — the empty "Start From Scratch" onboarding tour
 * ------------------------------------------------------------
 * A brand-new tour manager opens the app with nothing: no route,
 * no rider, no crew but themselves. They build the tour up by
 * uploading the project's sample fixture files. See CLAUDE.md
 * "Data modes" for the full flow.
 *
 * This is a minimal shell: named, with the standard group
 * taxonomy and a single Tour Manager. Everything else is empty
 * until an import populates it.
 * ============================================================
 */

import type { ID, Tour, Person, TourPerson, CurrentUser } from '@/types';
import { groups } from '@/data/groups';
import { getTodayIso } from '@/lib/today';
import { buildScheduleTypeDefaults } from '@/lib/visibilityDefaults';

export const SCRATCH_ORG_ID = 'org_scratch';
export const SCRATCH_TOUR_NAME = 'My Tour 2026';
export const SCRATCH_TM_TP_ID = 'tp_scratch_tm';
const SCRATCH_TM_PERSON_ID = 'p_scratch_tm';

const scratchTmPerson: Person = {
  id: SCRATCH_TM_PERSON_ID,
  name: 'Tour Manager',
};

const scratchTmTourPerson: TourPerson = {
  id: SCRATCH_TM_TP_ID,
  personId: SCRATCH_TM_PERSON_ID,
  person: scratchTmPerson,
  role: 'Tour Manager',
  groupId: 'grp_mgmt',
  tagIds: [],
  startDate: '',
  endDate: '',
};

/** Build a fresh, empty scratch tour — the minimal shell. `name` lets "+ New
 *  show" give the tour a real name up front so multiple drafts aren't
 *  indistinguishable in My Shows; omit it to fall back to the placeholder. */
export function createScratchTour(tourId: ID, name?: string): Tour {
  return {
    id: tourId,
    organizationId: SCRATCH_ORG_ID,
    name: name?.trim() || SCRATCH_TOUR_NAME,
    artistName: '',
    status: 'announced',
    // Placeholder span until a route is imported (applyRouteToScratch sets the
    // real dates). Kept valid so date formatters never see an empty string.
    startDate: getTodayIso(),
    endDate: getTodayIso(),
    legs: [],
    groups,
    groupTags: [],
    personnel: [scratchTmTourPerson],
    days: [],
    scheduleItems: [],
    travel: [],
    hotels: [],
    tasks: [],
    documents: [],
    flightImports: [],
    riderImports: [],
    visibilityDefaultsByType: buildScheduleTypeDefaults(),
  };
}

/**
 * Viewer-switcher map for the scratch tour. Derived from the tour's own
 * personnel (starts with just the TM, grows as the rider import adds the
 * band + crew), keyed by tourPersonId so keys are stable across reloads.
 */
export function scratchUsers(tour: Tour): Record<string, CurrentUser> {
  return Object.fromEntries(
    tour.personnel.map((tp) => [
      tp.id,
      {
        tourPersonId: tp.id,
        name: tp.person.name,
        role: tp.role,
        groupId: tp.groupId,
        tagIds: tp.tagIds,
      } satisfies CurrentUser,
    ]),
  );
}

/** Default viewer key for a scratch tour — the TM if present, else first person. */
export function scratchDefaultUserKey(tour: Tour): string {
  const tm = tour.personnel.find((p) => p.id === SCRATCH_TM_TP_ID);
  return tm?.id ?? tour.personnel[0]?.id ?? SCRATCH_TM_TP_ID;
}
