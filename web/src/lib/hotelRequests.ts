import type { Hotel, ID } from '@/types';

export interface HotelRequestOccupant {
  tourPersonId: ID;
  personName?: string;
  roomNumber?: string;
  requests: string[];
}

export interface HotelRequestGroup {
  hotelId: ID;
  hotelName: string;
  occupants: HotelRequestOccupant[];
}

// Rolls up every occupant's special requests grouped by hotel — a different
// shape than the catering dietary rollup (grouped by hotel, not by tag)
// since these are free-text asks, not a shared vocabulary to count by.
export function aggregateHotelRequests(
  hotels: Hotel[],
  getPersonName: (id: ID) => string | undefined,
): HotelRequestGroup[] {
  return hotels
    .map((h) => ({
      hotelId: h.id,
      hotelName: h.name,
      occupants: h.occupants
        .filter((o) => (o.specialRequests?.length ?? 0) > 0)
        .map((o) => ({
          tourPersonId: o.tourPersonId,
          personName: getPersonName(o.tourPersonId),
          roomNumber: o.roomNumber,
          requests: o.specialRequests ?? [],
        })),
    }))
    .filter((g) => g.occupants.length > 0);
}
