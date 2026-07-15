import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { SelectableRow } from '@/components/ui/SelectableRow';
import { useApp } from '@/state/AppState';
import { describeNegotiationEntry, formatQty } from '@/lib/negotiation';
import { cn } from '@/lib/cn';
import type { ID, ReconcileAction } from '@/types';

/** Just enough about the item to identify its thread and render it — the
 *  caller (AdvanceDetail) already has this on hand from the ShowAdvance. */
export interface ReconcileTarget {
  dayId: ID;
  itemKey: string;
  label: string;
  requestedQty: number;
  qtyLabel?: string;
  unit?: string;
  /** Section acknowledgments (Lodging, Permits, Stage specs, …) have no real
   *  requested quantity and get a differently-framed action set — see
   *  SECTION_ACK_ACTIONS below. */
  kind: 'item' | 'section_ack';
}

interface ReconcileModalProps {
  target: ReconcileTarget | null;
  onClose: () => void;
}

// Quantity-framed — for `item`-kind gaps (input list channels, backline,
// catering) where the venue reported short of what was requested.
const RECONCILE_ACTIONS: { action: ReconcileAction; label: string; needsSubstitution?: boolean }[] = [
  { action: 'accept_venue', label: "Accept the venue's count" },
  { action: 'band_brings', label: 'Band brings their own' },
  { action: 'substitute', label: 'Substitute', needsSubstitution: true },
  { action: 'drop', label: 'Drop this requirement' },
];

// Acknowledgment-framed — for `section_ack`-kind items (a whole section like
// Lodging or Stage specs that the venue flagged an issue with), where "the
// venue's count" / "substitute" don't describe anything real. Reuses the same
// four `ReconcileAction` values so the underlying model stays a single small
// enum — only the label (and the matching history phrasing in
// describeNegotiationEntry) differs.
const SECTION_ACK_ACTIONS: { action: ReconcileAction; label: string; needsSubstitution?: boolean }[] = [
  { action: 'accept_venue', label: 'Noted — proceeding as the venue described' },
  { action: 'substitute', label: 'Resolve a different way', needsSubstitution: true },
  { action: 'band_brings', label: 'Handled outside the app' },
  { action: 'drop', label: 'No longer applicable' },
];

/**
 * Reconcile a single negotiation-thread gap the venue reported on a show
 * advance. Mirrors ConflictResolveModal's resolved/form structure: an
 * already-confirmed item shows how it was settled (+ Reopen for managers);
 * otherwise the TM picks one of four reconciling moves.
 *
 * There's no propose/approve pair for reconciliation (unlike section edits
 * or conflicts) — only a manager can act here, so the form branch is
 * manager-only; AdvanceDetail only ever opens this for managerView anyway.
 */
export function ReconcileModal({ target, onClose }: ReconcileModalProps) {
  const { user, getNegotiationThread, reconcileItem, reopenNegotiation } = useApp();
  const managerView = user.groupId === 'grp_mgmt' || user.groupId === 'grp_production';

  const [action, setAction] = useState<ReconcileAction | null>(null);
  const [substitution, setSubstitution] = useState('');
  const [note, setNote] = useState('');

  // Reset form when the target item changes.
  useEffect(() => {
    if (!target) return;
    setAction(null);
    setSubstitution('');
    setNote('');
  }, [target?.dayId, target?.itemKey]);

  if (!target) return null;

  const thread = getNegotiationThread(target.dayId, target.itemKey);
  const qtyDisplay = formatQty(target);
  const actions = target.kind === 'section_ack' ? SECTION_ACK_ACTIONS : RECONCILE_ACTIONS;
  const canSubmit = action !== null && (action !== 'substitute' || substitution.trim().length > 0);

  const onSubmit = () => {
    if (!action) return;
    reconcileItem(
      target.dayId,
      target.itemKey,
      action,
      action === 'substitute' ? substitution.trim() : undefined,
      note.trim() || undefined,
    );
    onClose();
  };

  const resolvingEntry = thread?.entries[thread.entries.length - 1];

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      eyebrow="Venue negotiation"
      title={
        thread?.status === 'confirmed'
          ? 'Already confirmed'
          : thread?.status === 'awaiting_tm'
          ? 'Reconcile this item'
          : 'Waiting on the venue'
      }
      size="lg"
    >
      <div className="space-y-4">
        {/* Item header — a section acknowledgment has no real quantity. */}
        <div>
          <div className="text-[13px] font-semibold text-[var(--color-ink)]">{target.label}</div>
          {target.kind === 'item' && (
            <div className="font-mono text-[10.5px] uppercase tracking-[0.10em] text-[var(--color-ink-3)] mt-0.5">
              Requested: {qtyDisplay}
            </div>
          )}
        </div>

        {thread?.status === 'confirmed' ? (
          /* RESOLVED */
          <div className="border border-[var(--color-rule)] rounded-[4px] p-4 bg-[var(--color-paper-2)]/40">
            <div className="flex items-center gap-2 mb-2">
              <Icon.Check size={14} className="text-[var(--color-moss)]" />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
                {resolvingEntry && `${resolvingEntry.stamp.by} · ${new Date(resolvingEntry.stamp.at).toLocaleString()}`}
              </span>
            </div>
            <div className="text-[13px] font-semibold text-[var(--color-ink)]">
              {resolvingEntry ? describeNegotiationEntry(resolvingEntry, target, user.name) : 'Confirmed'}
            </div>
            {managerView && (
              <button
                type="button"
                onClick={() => { reopenNegotiation(target.dayId, target.itemKey); onClose(); }}
                className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold rounded-[3px] border border-[var(--color-rule)] hover:border-[var(--color-ink-4)] text-[var(--color-ink-2)]"
              >
                Reopen
              </button>
            )}
          </div>
        ) : thread?.status === 'awaiting_tm' ? (
          /* FORM */
          !managerView ? (
            <p className="text-[13px] text-[var(--color-ink-3)] leading-relaxed">
              A manager needs to decide how to handle this gap. Check back once it's reconciled.
            </p>
          ) : (
            <>
              {/* What the venue said (last entry) */}
              {resolvingEntry && (
                <div className="border-l-2 border-[var(--color-accent)] pl-3 py-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] mb-0.5">
                    Venue said
                  </div>
                  <p className="text-[12.5px] text-[var(--color-ink-2)] leading-relaxed">
                    {describeNegotiationEntry(resolvingEntry, target, user.name)}
                  </p>
                </div>
              )}

              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] mb-2">
                  How do you want to handle it?
                </div>
                <ul className="space-y-1.5">
                  {actions.map((opt) => (
                    <li key={opt.action}>
                      <SelectableRow
                        selected={action === opt.action}
                        onSelect={() => setAction(opt.action)}
                      >
                        <div className="text-[12.5px] font-semibold text-[var(--color-ink)]">{opt.label}</div>
                        {opt.needsSubstitution && action === opt.action && (
                          <input
                            type="text"
                            value={substitution}
                            onChange={(e) => setSubstitution(e.target.value)}
                            placeholder="What's being substituted?"
                            className="w-full h-8 px-2 text-[12.5px] rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-card)] mt-1.5 outline-none focus:border-[var(--color-ink-4)]"
                          />
                        )}
                      </SelectableRow>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] mb-1.5 block">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Confirmed with the house PM by phone"
                  className="w-full h-9 px-2.5 text-[12.5px] rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-card)] outline-none focus:border-[var(--color-ink-4)]"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[var(--color-rule-soft)]">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] font-semibold rounded-[3px] text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={onSubmit}
                  className={cn(
                    'inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] font-semibold rounded-[3px]',
                    canSubmit
                      ? 'bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]'
                      : 'bg-[var(--color-paper-3)] text-[var(--color-ink-4)] cursor-not-allowed',
                  )}
                >
                  <Icon.Check size={13} /> Reconcile
                </button>
              </div>
            </>
          )
        ) : (
          /* No thread yet, or still awaiting_venue — shouldn't normally be
           * reachable (AdvanceDetail only opens this modal on awaiting_tm),
           * but keep it safe rather than rendering a broken form. */
          <p className="text-[13px] text-[var(--color-ink-3)] leading-relaxed">
            This item hasn't come back from the venue yet — there's nothing to reconcile.
          </p>
        )}
      </div>
    </Modal>
  );
}
