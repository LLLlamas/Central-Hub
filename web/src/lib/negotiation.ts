// Pure state transitions for the per-show rider negotiation thread: the venue
// responds to each requested item, the TM reconciles any gap, and either side
// can reopen a confirmed item later. No React, no storage I/O — AppState
// mutators own persistence, the same split as lib/riderItems.ts.

import type {
  ID,
  NegotiationEntry,
  NegotiationThread,
  ReconcileAction,
  RiderItemSnapshot,
  UpdateStamp,
  VenueItemAnswer,
} from '@/types';

function mintId(prefix: string): ID {
  return `${prefix}_${crypto.randomUUID()}`;
}

/** Composite key for the thread map — mirrors the `${a}::${b}` pattern AppState
 *  already uses for `flightPassengerResolutions` (see `resKey` there). */
export function threadKey(showDayId: string, itemKey: string): string {
  return `${showDayId}::${itemKey}`;
}

/**
 * Fold in the venue's response to one item. Auto-confirms when the venue has
 * everything requested (an explicit `acknowledged`, or `have` with no partial
 * qty, or `have` with qtyOffered >= requestedQty); anything short of the full
 * ask lands on `awaiting_tm` so the TM can reconcile the gap.
 */
export function applyVenueResponse(
  thread: NegotiationThread | undefined,
  showDayId: string,
  itemKey: string,
  item: RiderItemSnapshot,
  answer: VenueItemAnswer,
  qtyOffered: number | undefined,
  note: string | undefined,
  stamp: UpdateStamp,
): NegotiationThread {
  const base: NegotiationThread = thread ?? {
    showDayId,
    itemKey,
    entries: [],
    status: 'awaiting_venue',
  };

  const entry: NegotiationEntry = {
    id: mintId('neg'),
    kind: 'venue_response',
    answer,
    qtyOffered,
    note,
    stamp,
  };

  const fullyHave =
    answer === 'acknowledged' ||
    (answer === 'have' && (qtyOffered === undefined || qtyOffered >= item.requestedQty));

  return {
    ...base,
    entries: [...base.entries, entry],
    status: fullyHave ? 'confirmed' : 'awaiting_tm',
  };
}

/**
 * Fold in the TM's reconciling move for a gap the venue reported. Whichever
 * action the TM picks (accept what the venue has, have the band bring their
 * own, substitute, or drop the requirement), the item is resolved for this
 * show — always lands on `confirmed`.
 */
export function applyReconcile(
  thread: NegotiationThread,
  action: ReconcileAction,
  substitution: string | undefined,
  note: string | undefined,
  stamp: UpdateStamp,
): NegotiationThread {
  const entry: NegotiationEntry = {
    id: mintId('neg'),
    kind: 'tm_reconcile',
    action,
    substitution,
    note,
    stamp,
  };

  return {
    ...thread,
    entries: [...thread.entries, entry],
    status: 'confirmed',
  };
}

/** Revisit an already-confirmed item — sends it back to the venue. */
export function reopenThread(
  thread: NegotiationThread,
  note: string | undefined,
  stamp: UpdateStamp,
): NegotiationThread {
  const entry: NegotiationEntry = {
    id: mintId('neg'),
    kind: 'reopened',
    note,
    stamp,
  };

  return {
    ...thread,
    entries: [...thread.entries, entry],
    status: 'awaiting_venue',
  };
}

/**
 * True only when every item currently expected for the show has a thread and
 * that thread is `confirmed`. An empty item list can't be "fully confirmed" —
 * there's nothing to confirm.
 */
export function isShowFullyConfirmed(
  items: RiderItemSnapshot[],
  threads: ReadonlyMap<string, NegotiationThread>,
  showDayId: string,
): boolean {
  if (items.length === 0) return false;
  return items.every((item) => threads.get(threadKey(showDayId, item.itemKey))?.status === 'confirmed');
}

/** "2 dozen" (qtyLabel wins verbatim) or "4 mics" (unit) or plain "4". Shared
 *  by AdvanceDetail's item rows and ReconcileModal so the two surfaces never
 *  drift on how a requested quantity reads. */
export function formatQty(item: Pick<RiderItemSnapshot, 'requestedQty' | 'qtyLabel' | 'unit'>): string {
  if (item.qtyLabel) return item.qtyLabel;
  return item.unit ? `${item.requestedQty} ${item.unit}` : `${item.requestedQty}`;
}

/**
 * Plain-English, non-jargon description of one thread entry — shared by
 * AdvanceDetail's expandable history and ReconcileModal's resolved summary
 * so the two surfaces never drift in voice.
 */
export function describeNegotiationEntry(
  entry: NegotiationEntry,
  item: Pick<RiderItemSnapshot, 'requestedQty' | 'qtyLabel' | 'unit' | 'kind'>,
  viewerName: string,
): string {
  const isAck = item.kind === 'section_ack';
  switch (entry.kind) {
    case 'venue_response':
      switch (entry.answer) {
        case 'have':
          return 'Venue said: have it';
        case 'partial':
          return `Venue said: have ${entry.qtyOffered ?? '?'} of ${formatQty(item)}`;
        case 'dont_have':
          return `Venue said: don't have it${entry.note ? ` — ${entry.note}` : ''}`;
        case 'acknowledged':
          return 'Venue acknowledged this';
        case 'issue':
          return `Venue flagged an issue${entry.note ? `: ${entry.note}` : ''}`;
        default:
          return 'Venue responded';
      }
    case 'tm_reconcile': {
      const who = entry.stamp.by === viewerName ? 'You' : entry.stamp.by;
      // Section acknowledgments (Lodging, Permits, Stage specs, …) have no
      // real requested quantity, so the quantity-flavored action labels get
      // reworded to fit "resolving a flagged issue on a whole section"
      // instead — see ReconcileModal's SECTION_ACK_ACTIONS.
      if (isAck) {
        switch (entry.action) {
          case 'accept_venue':
            return `${who}: noted, proceeding as reported`;
          case 'drop':
            return `${who}: marked no longer applicable`;
          case 'band_brings':
            return `${who}: handled outside the app`;
          case 'substitute':
            return `${who}: resolved${entry.substitution ? ` — ${entry.substitution}` : ''}`;
          default:
            return `${who}: reconciled`;
        }
      }
      switch (entry.action) {
        case 'accept_venue':
          return `${who}: accepted venue's count`;
        case 'band_brings':
          return `${who}: band will bring their own`;
        case 'substitute':
          return `${who}: substituted${entry.substitution ? ` — ${entry.substitution}` : ''}`;
        case 'drop':
          return `${who}: dropped this requirement`;
        default:
          return `${who}: reconciled`;
      }
    }
    case 'reopened':
      return `Reopened${entry.note ? ` — ${entry.note}` : ''}`;
    case 'note':
      return entry.note ?? 'Note added';
    default:
      return 'Update';
  }
}
