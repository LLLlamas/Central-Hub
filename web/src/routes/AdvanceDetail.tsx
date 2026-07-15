import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, EmptyState } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { ReconcileModal } from '@/components/ReconcileModal';
import type { ReconcileTarget } from '@/components/ReconcileModal';
import { getVenueForTour } from '@/data/venues';
import { describeNegotiationEntry, formatQty } from '@/lib/negotiation';
import { fmtFullDate } from '@/lib/format';
import { tourPath } from '@/lib/routing';
import { isVenuePersona as isVenueGroup } from '@/lib/access';
import type { NegotiationThread, RiderItemSnapshot } from '@/types';

function threadStatusLabel(thread: NegotiationThread | undefined, managerView: boolean): string {
  const status = thread?.status ?? 'awaiting_venue';
  if (status === 'confirmed') return 'Confirmed';
  if (status === 'awaiting_tm') return managerView ? 'Needs your review' : 'Pending';
  return 'Awaiting venue response';
}

function threadStatusTone(thread: NegotiationThread | undefined): 'success' | 'critical' | 'neutral' {
  const status = thread?.status ?? 'awaiting_venue';
  if (status === 'confirmed') return 'success';
  if (status === 'awaiting_tm') return 'critical';
  return 'neutral';
}

/**
 * Per-show negotiation detail — the rider's items for this venue, each with
 * a stamped back-and-forth thread. Three readers, three surfaces:
 *   - venue persona (grp_venue) answers each item ("have it" / "have some" /
 *     "don't have it", or "acknowledged" / "flag an issue" for section-level
 *     items) via the viewer-switcher, same mechanism every other propose/
 *     approve workflow in this app uses to simulate the other side.
 *   - managers reconcile any gap the venue reports (ReconcileModal).
 *   - everyone else gets a read-only view of status + history.
 */
export function AdvanceDetail() {
  const { dayId } = useParams<{ dayId: string }>();
  const {
    tour,
    user,
    getDayById,
    getShowAdvance,
    getNegotiationThread,
    sendRiderToVenue,
    recordVenueResponse,
  } = useApp();

  const [reconcileTarget, setReconcileTarget] = useState<ReconcileTarget | null>(null);

  const day = dayId ? getDayById(dayId) : undefined;
  const managerView = user.groupId === 'grp_mgmt' || user.groupId === 'grp_production';
  const isVenuePersona = isVenueGroup(user);
  // A venue persona is scoped to their own show — matches Advance.tsx's list
  // filter (`showDays.filter(...)`). Direct navigation (URL edit, bookmark,
  // back/forward) to another show's advance shouldn't hand them another
  // venue's response controls.
  const venuePersona = isVenuePersona && !!day?.venueId && user.tourPersonId === `tp_venue_${day.venueId}`;
  const wrongVenue = isVenuePersona && day && !venuePersona;

  const advance = day ? getShowAdvance(day.id) : undefined;
  const venue = day ? getVenueForTour(tour, day.venueId) : undefined;

  // Items still requested by the current rider vs. ones a re-send dropped —
  // those are kept (not deleted) so their negotiation history isn't lost,
  // but they're read-only and excluded from confirmation counts/bulk actions.
  const activeItems = useMemo(() => (advance?.items ?? []).filter((it) => !it.stale), [advance]);
  const staleItems = useMemo(() => (advance?.items ?? []).filter((it) => it.stale), [advance]);

  const groups = useMemo(() => {
    const list: { sectionId: string; sectionTitle: string; items: RiderItemSnapshot[] }[] = [];
    for (const item of activeItems) {
      const last = list[list.length - 1];
      if (last && last.sectionId === item.sectionId) {
        last.items.push(item);
      } else {
        list.push({ sectionId: item.sectionId, sectionTitle: item.sectionTitle, items: [item] });
      }
    }
    return list;
  }, [activeItems]);

  const unconfirmedItems = useMemo(
    () =>
      day
        ? activeItems.filter((it) => getNegotiationThread(day.id, it.itemKey)?.status !== 'confirmed')
        : [],
    [day, activeItems, getNegotiationThread],
  );

  if (!day) {
    return (
      <div>
        <PageHeader title="Show not found" />
        <EmptyState
          title="That day isn't on this tour"
          hint="Pick a show date from the calendar."
          action={
            <Link to={tourPath(tour.id, 'calendar')} className="text-[13px] underline">
              ← Back to calendar
            </Link>
          }
        />
      </div>
    );
  }

  if (wrongVenue) {
    return (
      <div>
        <PageHeader title="Not your show" />
        <EmptyState
          title="This advance isn't for your venue"
          hint="You're signed in as a different venue's contact — check the advance board for your own show."
          action={
            <Link to={tourPath(tour.id, 'advance')} className="text-[13px] underline">
              ← Back to advance board
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={`Venue advance · ${venue?.name ?? 'Venue not yet assigned'}`}
        title={fmtFullDate(day.date)}
        description="The rider sent to this show's venue, and how the back-and-forth on each item is going."
        meta={
          advance ? (
            <Chip tone={advance.status === 'confirmed' ? 'success' : 'neutral'} size="sm">
              {activeItems.length - unconfirmedItems.length} of {activeItems.length} items confirmed
            </Chip>
          ) : undefined
        }
        actions={
          venuePersona && unconfirmedItems.length > 0 ? (
            <Button
              variant="primary"
              onClick={() => {
                for (const it of unconfirmedItems) {
                  recordVenueResponse(day.id, it.itemKey, it.kind === 'section_ack' ? 'acknowledged' : 'have');
                }
              }}
            >
              Mark all remaining as Have
            </Button>
          ) : undefined
        }
      />

      {!advance ? (
        <Card>
          <EmptyState
            title="Rider not sent to this venue yet"
            hint={
              managerView
                ? 'Send the current rider to start the back-and-forth on what the venue can provide.'
                : "The tour manager hasn't sent the rider to this show's venue yet."
            }
            action={
              managerView ? (
                <Button variant="primary" onClick={() => sendRiderToVenue(day.id)}>
                  Send rider to venue
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.sectionId} padded={false} className="overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--color-rule-soft)] bg-[var(--color-paper-2)]/30">
                <div className="text-[13.5px] font-semibold text-[var(--color-ink)]">{group.sectionTitle}</div>
              </div>
              <div className="px-5">
                {group.items.map((item) => (
                  <ItemRow
                    key={item.itemKey}
                    item={item}
                    dayId={day.id}
                    managerView={managerView}
                    venuePersona={venuePersona}
                    viewerName={user.name}
                    onReconcile={(target) => setReconcileTarget(target)}
                  />
                ))}
              </div>
            </Card>
          ))}

          {staleItems.length > 0 && (
            <Card padded={false} className="overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--color-rule-soft)] bg-[var(--color-paper-2)]/30">
                <div className="text-[13.5px] font-semibold text-[var(--color-ink)]">
                  No longer in the current rider
                </div>
                <div className="text-[11.5px] text-[var(--color-ink-3)] mt-0.5">
                  These items were negotiated on an earlier version of the rider and were removed since — kept here
                  for the record, but there's nothing left to do on them.
                </div>
              </div>
              <div className="px-5">
                {staleItems.map((item) => (
                  <ItemRow
                    key={item.itemKey}
                    item={item}
                    dayId={day.id}
                    managerView={managerView}
                    venuePersona={venuePersona}
                    viewerName={user.name}
                    onReconcile={(target) => setReconcileTarget(target)}
                    stale
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <ReconcileModal target={reconcileTarget} onClose={() => setReconcileTarget(null)} />
    </div>
  );
}

function ItemRow({
  item,
  dayId,
  managerView,
  venuePersona,
  viewerName,
  onReconcile,
  stale = false,
}: {
  item: RiderItemSnapshot;
  dayId: string;
  managerView: boolean;
  venuePersona: boolean;
  viewerName: string;
  onReconcile: (target: ReconcileTarget) => void;
  stale?: boolean;
}) {
  const { getNegotiationThread, recordVenueResponse } = useApp();
  const thread = getNegotiationThread(dayId, item.itemKey);

  const [expanded, setExpanded] = useState(false);
  // Single "which inline form is open" state — one at a time, so opening one
  // panel implicitly closes any other (no manual close-the-others bookkeeping).
  const [openPanel, setOpenPanel] = useState<'partial' | 'dontHave' | 'issue' | null>(null);
  const [partialQty, setPartialQty] = useState(1);
  const [dontHaveNote, setDontHaveNote] = useState('');
  const [issueNote, setIssueNote] = useState('');

  const status = thread?.status ?? 'awaiting_venue';
  const confirmed = status === 'confirmed';
  const needsReconcile = status === 'awaiting_tm';
  const qtyDisplay = formatQty(item);

  const openReconcile = () =>
    onReconcile({
      dayId,
      itemKey: item.itemKey,
      label: item.label,
      requestedQty: item.requestedQty,
      qtyLabel: item.qtyLabel,
      unit: item.unit,
      kind: item.kind,
    });

  return (
    <div className="border-b border-[var(--color-rule-soft)] last:border-b-0 py-3.5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-[var(--color-ink)]">{item.label}</div>
          {item.kind === 'item' && (
            <div className="text-[11.5px] text-[var(--color-ink-3)] mt-0.5">Requested: {qtyDisplay}</div>
          )}
          {item.notes && (
            <div className="text-[11.5px] text-[var(--color-ink-3)] italic mt-0.5">{item.notes}</div>
          )}
          {stale && (
            <div className="text-[11.5px] text-[var(--color-ink-4)] italic mt-0.5">
              No longer in the current rider
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Chip tone={stale ? 'neutral' : threadStatusTone(thread)} size="sm">
            {threadStatusLabel(thread, managerView)}
          </Chip>
          {thread && thread.entries.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-ink)] underline underline-offset-2"
            >
              {expanded ? 'Hide history' : `History (${thread.entries.length})`}
            </button>
          )}
        </div>
      </div>

      {expanded && thread && (
        <ul className="mt-2.5 space-y-1.5 pl-3 border-l-2 border-[var(--color-rule-soft)]">
          {thread.entries.map((entry) => (
            <li key={entry.id} className="text-[12px] leading-relaxed">
              <span className="text-[var(--color-ink-2)]">{describeNegotiationEntry(entry, item, viewerName)}</span>
              <span className="text-[var(--color-ink-4)]">
                {' '}
                · {entry.stamp.by}, {new Date(entry.stamp.at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!stale && (
        <>
          {/* Venue-persona response controls — hidden once the venue has
              already answered (awaiting_tm) so they can't submit a second,
              conflicting response before the TM reconciles the first. */}
          {venuePersona && status === 'awaiting_venue' && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {item.kind === 'item' ? (
                <>
                  <Button size="sm" onClick={() => { setOpenPanel(null); recordVenueResponse(dayId, item.itemKey, 'have'); }}>
                    We have it
                  </Button>
                  {item.requestedQty > 1 && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setPartialQty(Math.max(1, item.requestedQty - 1));
                        setOpenPanel((p) => (p === 'partial' ? null : 'partial'));
                      }}
                    >
                      We have some
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setOpenPanel((p) => (p === 'dontHave' ? null : 'dontHave'))}>
                    We don't have it
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" onClick={() => { setOpenPanel(null); recordVenueResponse(dayId, item.itemKey, 'acknowledged'); }}>
                    Acknowledged
                  </Button>
                  <Button size="sm" onClick={() => setOpenPanel((p) => (p === 'issue' ? null : 'issue'))}>
                    Flag an issue
                  </Button>
                </>
              )}
            </div>
          )}

          {venuePersona && status === 'awaiting_tm' && (
            <div className="mt-2.5 text-[11.5px] text-[var(--color-ink-3)] italic">
              You already responded — waiting on the tour manager.
            </div>
          )}

          {openPanel === 'partial' && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
              <div className="inline-flex items-center gap-2 border border-[var(--color-rule)] rounded-[3px] px-2 h-8">
                <button
                  type="button"
                  onClick={() => setPartialQty((q) => Math.max(1, q - 1))}
                  className="text-[14px] font-semibold text-[var(--color-ink-2)] hover:text-[var(--color-ink)] w-4"
                >
                  −
                </button>
                <span className="text-[12.5px] font-semibold w-6 text-center">{partialQty}</span>
                <button
                  type="button"
                  onClick={() => setPartialQty((q) => Math.min(item.requestedQty, q + 1))}
                  className="text-[14px] font-semibold text-[var(--color-ink-2)] hover:text-[var(--color-ink)] w-4"
                >
                  +
                </button>
              </div>
              <span className="text-[11.5px] text-[var(--color-ink-3)]">of {qtyDisplay} requested</span>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  recordVenueResponse(dayId, item.itemKey, 'partial', partialQty);
                  setOpenPanel(null);
                }}
              >
                Submit
              </Button>
            </div>
          )}

          {openPanel === 'dontHave' && (
            <NotePrompt
              value={dontHaveNote}
              onChange={setDontHaveNote}
              placeholder="Optional note"
              buttonLabel="Confirm"
              onSubmit={() => {
                recordVenueResponse(dayId, item.itemKey, 'dont_have', undefined, dontHaveNote.trim() || undefined);
                setOpenPanel(null);
                setDontHaveNote('');
              }}
            />
          )}

          {openPanel === 'issue' && (
            <NotePrompt
              value={issueNote}
              onChange={setIssueNote}
              placeholder="What's the issue?"
              buttonLabel="Submit"
              onSubmit={() => {
                recordVenueResponse(dayId, item.itemKey, 'issue', undefined, issueNote.trim() || undefined);
                setOpenPanel(null);
                setIssueNote('');
              }}
            />
          )}

          {/* Manager reconcile — also reachable once confirmed, so a manager
              can reopen an item the venue backs out of later (ReconcileModal's
              "Already confirmed" branch has a Reopen action for this). */}
          {managerView && (needsReconcile || confirmed) && (
            <div className="mt-2.5">
              <Button size="sm" variant="outline" onClick={openReconcile}>
                {needsReconcile ? 'Reconcile' : 'Review'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Shared inline text-prompt-then-submit row for the "don't have it" and
 *  "flag an issue" venue responses — identical layout, different copy. */
function NotePrompt({
  value,
  onChange,
  placeholder,
  buttonLabel,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  buttonLabel: string;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 px-2 text-[12.5px] rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-card)] outline-none focus:border-[var(--color-ink-4)] w-56"
      />
      <Button size="sm" variant="primary" onClick={onSubmit}>
        {buttonLabel}
      </Button>
    </div>
  );
}
