import { describe, it, expect } from 'vitest';
import { aggregateHotelRequests } from '@/lib/hotelRequests';
import type { Hotel } from '@/types';

const baseHotel: Omit<Hotel, 'id' | 'occupants'> = {
  dayId: 'day_2026-09-22',
  name: 'Hotel A',
  address: '123 Main St',
  visibility: { default: 'sees' },
  sensitive: false,
};

const names: Record<string, string> = {
  tp_1: 'Elsa Carvajal',
  tp_2: 'Julian Bernal',
};

describe('aggregateHotelRequests', () => {
  it('groups occupants with requests by hotel', () => {
    const hotels: Hotel[] = [
      {
        ...baseHotel,
        id: 'h1',
        occupants: [
          { tourPersonId: 'tp_1', roomNumber: '101', specialRequests: ['gluten-free snacks'] },
          { tourPersonId: 'tp_2', roomNumber: '102' },
        ],
      },
    ];
    const result = aggregateHotelRequests(hotels, (id) => names[id]);
    expect(result).toEqual([
      {
        hotelId: 'h1',
        hotelName: 'Hotel A',
        occupants: [
          { tourPersonId: 'tp_1', personName: 'Elsa Carvajal', roomNumber: '101', requests: ['gluten-free snacks'] },
        ],
      },
    ]);
  });

  it('omits hotels with no special requests at all', () => {
    const hotels: Hotel[] = [
      { ...baseHotel, id: 'h1', occupants: [{ tourPersonId: 'tp_1', roomNumber: '101' }] },
    ];
    expect(aggregateHotelRequests(hotels, (id) => names[id])).toEqual([]);
  });

  it('handles an unknown person id gracefully', () => {
    const hotels: Hotel[] = [
      { ...baseHotel, id: 'h1', occupants: [{ tourPersonId: 'tp_9', specialRequests: ['extra pillows'] }] },
    ];
    const result = aggregateHotelRequests(hotels, () => undefined);
    expect(result[0].occupants[0]).toEqual({
      tourPersonId: 'tp_9',
      personName: undefined,
      roomNumber: undefined,
      requests: ['extra pillows'],
    });
  });

  it('returns an empty array for no hotels', () => {
    expect(aggregateHotelRequests([], () => undefined)).toEqual([]);
  });
});
