// Pure query helpers over a Tour object.
// Previously these lived in data/mockTour.ts and read the static mockTour
// directly — which bypassed the demo/scratch tour swap. They now take an
// explicit `tour` so they work against whichever tour is active. AppState
// re-exposes them bound to the active tour (see state/AppState.tsx).

import type {
  Tour,
  Day,
  ScheduleItem,
  Travel,
  Hotel,
  Task,
  TourPerson,
  Group,
  GroupTag,
  Conflict,
} from '@/types';

export function getDay(tour: Tour, date: string): Day | undefined {
  return tour.days.find((d) => d.date === date);
}

export function getDayById(tour: Tour, id: string): Day | undefined {
  return tour.days.find((d) => d.id === id);
}

export function getScheduleItemsForDay(tour: Tour, dayId: string): ScheduleItem[] {
  return tour.scheduleItems.filter((s) => s.dayId === dayId);
}

export function getTravelForDay(tour: Tour, dayId: string): Travel[] {
  return tour.travel.filter((t) => t.dayId === dayId);
}

// Hotels are keyed to their check-in day. A multi-night block also covers the
// nights between check-in and check-out, so we surface it on those days too.
export function getHotelsForDay(tour: Tour, dayId: string): Hotel[] {
  const currentDay = tour.days.find((d) => d.id === dayId);
  if (!currentDay) return [];
  return tour.hotels.filter((h) => {
    if (h.dayId === dayId) return true;
    if (!h.nights || h.nights <= 1) return false;
    const checkInDay = tour.days.find((d) => d.id === h.dayId);
    if (!checkInDay) return false;
    const diffDays = Math.round(
      (new Date(currentDay.date).getTime() - new Date(checkInDay.date).getTime()) / 86400000,
    );
    return diffDays > 0 && diffDays < h.nights;
  });
}

export function getTasksForDay(tour: Tour, dayId: string): Task[] {
  return tour.tasks.filter((t) => t.dayId === dayId);
}

export function getTourPersonById(tour: Tour, id: string): TourPerson | undefined {
  return tour.personnel.find((p) => p.id === id);
}

export function getGroupById(tour: Tour, id: string): Group | undefined {
  return tour.groups.find((g) => g.id === id);
}

export function getGroupTagById(tour: Tour, id: string): GroupTag | undefined {
  return tour.groupTags.find((t) => t.id === id);
}

export function getAllConflicts(tour: Tour): Conflict[] {
  return tour.riderImports.flatMap((ri) =>
    ri.sections.flatMap((s) => s.conflicts ?? []),
  );
}
