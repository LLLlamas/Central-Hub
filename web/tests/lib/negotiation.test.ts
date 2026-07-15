import { describe, it, expect } from 'vitest';
import {
  applyReconcile,
  applyVenueResponse,
  isShowFullyConfirmed,
  reopenThread,
  threadKey,
} from '@/lib/negotiation';
import type { NegotiationThread, RiderItemSnapshot, UpdateStamp } from '@/types';

const stamp: UpdateStamp = { at: '2026-09-22T10:00', by: 'Tour Manager' };

function item(patch: Partial<RiderItemSnapshot> = {}): RiderItemSnapshot {
  return {
    itemKey: 'sec_1::ch1',
    sectionId: 'sec_1',
    sectionType: 'input_list',
    sectionTitle: 'Input List',
    kind: 'item',
    label: 'Ch1 Kick',
    requestedQty: 4,
    ...patch,
  };
}

describe('threadKey', () => {
  it('joins showDayId and itemKey with a double colon', () => {
    expect(threadKey('day_2026-09-22', 'sec_1::ch1')).toBe('day_2026-09-22::sec_1::ch1');
  });
});

describe('applyVenueResponse', () => {
  it('auto-confirms on acknowledged', () => {
    const thread = applyVenueResponse(undefined, 'day_1', 'sec_1', item(), 'acknowledged', undefined, undefined, stamp);
    expect(thread.status).toBe('confirmed');
    expect(thread.entries).toHaveLength(1);
    expect(thread.entries[0].kind).toBe('venue_response');
    expect(thread.entries[0].answer).toBe('acknowledged');
    expect(thread.showDayId).toBe('day_1');
    expect(thread.itemKey).toBe('sec_1');
  });

  it('auto-confirms on "have" with no qtyOffered (full requested amount implied)', () => {
    const thread = applyVenueResponse(undefined, 'day_1', 'sec_1', item({ requestedQty: 4 }), 'have', undefined, undefined, stamp);
    expect(thread.status).toBe('confirmed');
  });

  it('auto-confirms on "have" with qtyOffered >= requestedQty', () => {
    const thread = applyVenueResponse(undefined, 'day_1', 'sec_1', item({ requestedQty: 4 }), 'have', 5, undefined, stamp);
    expect(thread.status).toBe('confirmed');
  });

  it('lands on awaiting_tm for "have" short of requestedQty', () => {
    const thread = applyVenueResponse(undefined, 'day_1', 'sec_1', item({ requestedQty: 4 }), 'have', 2, undefined, stamp);
    expect(thread.status).toBe('awaiting_tm');
  });

  it('lands on awaiting_tm for partial', () => {
    const thread = applyVenueResponse(undefined, 'day_1', 'sec_1', item(), 'partial', 2, 'only 2 available', stamp);
    expect(thread.status).toBe('awaiting_tm');
    expect(thread.entries[0].note).toBe('only 2 available');
  });

  it('lands on awaiting_tm for dont_have', () => {
    const thread = applyVenueResponse(undefined, 'day_1', 'sec_1', item(), 'dont_have', undefined, undefined, stamp);
    expect(thread.status).toBe('awaiting_tm');
  });

  it('lands on awaiting_tm for issue', () => {
    const thread = applyVenueResponse(undefined, 'day_1', 'sec_1', item(), 'issue', undefined, 'venue flagged a concern', stamp);
    expect(thread.status).toBe('awaiting_tm');
  });

  it('appends to an existing thread rather than replacing it', () => {
    const first = applyVenueResponse(undefined, 'day_1', 'sec_1', item(), 'partial', 2, undefined, stamp);
    const second = applyVenueResponse(first, 'day_1', 'sec_1', item(), 'have', 4, undefined, stamp);
    expect(second.entries).toHaveLength(2);
    expect(second.status).toBe('confirmed');
  });
});

describe('applyReconcile', () => {
  const pending: NegotiationThread = {
    showDayId: 'day_1',
    itemKey: 'sec_1',
    entries: [{ id: 'neg_1', kind: 'venue_response', answer: 'partial', qtyOffered: 2, stamp }],
    status: 'awaiting_tm',
  };

  it.each([['accept_venue'], ['band_brings'], ['substitute'], ['drop']] as const)(
    'always lands on confirmed for action %s',
    (action) => {
      const result = applyReconcile(pending, action, undefined, undefined, stamp);
      expect(result.status).toBe('confirmed');
      expect(result.entries).toHaveLength(2);
      expect(result.entries[1].kind).toBe('tm_reconcile');
      expect(result.entries[1].action).toBe(action);
    },
  );

  it('carries substitution and note through', () => {
    const result = applyReconcile(pending, 'substitute', 'house kit', 'swapped for house kit', stamp);
    expect(result.entries[1].substitution).toBe('house kit');
    expect(result.entries[1].note).toBe('swapped for house kit');
  });
});

describe('reopenThread', () => {
  it('lands on awaiting_venue and appends a reopened entry', () => {
    const confirmed: NegotiationThread = {
      showDayId: 'day_1',
      itemKey: 'sec_1',
      entries: [{ id: 'neg_1', kind: 'venue_response', answer: 'acknowledged', stamp }],
      status: 'confirmed',
    };
    const result = reopenThread(confirmed, 'rider updated, revisit', stamp);
    expect(result.status).toBe('awaiting_venue');
    expect(result.entries).toHaveLength(2);
    expect(result.entries[1].kind).toBe('reopened');
    expect(result.entries[1].note).toBe('rider updated, revisit');
  });
});

describe('isShowFullyConfirmed', () => {
  const items = [item({ itemKey: 'a' }), item({ itemKey: 'b' })];

  it('is false when the items array is empty', () => {
    expect(isShowFullyConfirmed([], new Map(), 'day_1')).toBe(false);
  });

  it('is false when a thread is missing for an item', () => {
    const threads = new Map<string, NegotiationThread>([
      [threadKey('day_1', 'a'), { showDayId: 'day_1', itemKey: 'a', entries: [], status: 'confirmed' }],
    ]);
    expect(isShowFullyConfirmed(items, threads, 'day_1')).toBe(false);
  });

  it('is false when a thread exists but is not confirmed', () => {
    const threads = new Map<string, NegotiationThread>([
      [threadKey('day_1', 'a'), { showDayId: 'day_1', itemKey: 'a', entries: [], status: 'confirmed' }],
      [threadKey('day_1', 'b'), { showDayId: 'day_1', itemKey: 'b', entries: [], status: 'awaiting_tm' }],
    ]);
    expect(isShowFullyConfirmed(items, threads, 'day_1')).toBe(false);
  });

  it('is true when every item has a confirmed thread', () => {
    const threads = new Map<string, NegotiationThread>([
      [threadKey('day_1', 'a'), { showDayId: 'day_1', itemKey: 'a', entries: [], status: 'confirmed' }],
      [threadKey('day_1', 'b'), { showDayId: 'day_1', itemKey: 'b', entries: [], status: 'confirmed' }],
    ]);
    expect(isShowFullyConfirmed(items, threads, 'day_1')).toBe(true);
  });
});
