import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { RiderRef, linkifyRiderRefs } from '@/components/RiderRef';
import { useApp } from '@/state/AppState';
import { cn } from '@/lib/cn';
import type { Conflict } from '@/types';

interface ConflictResolveModalProps {
  conflict: Conflict | null;
  onClose: () => void;
}

/**
 * Resolution flow for a single rider conflict.
 *
 * Shows the conflict description, lists each conflicting value as a
 * pickable option, exposes a custom value input, and provides one-tap
 * contact shortcuts to the production manager so the TM can confirm the
 * correct answer before resolving. "Mark resolved" persists the choice
 * in AppState; resolved conflicts collapse out of the active feed.
 */
export function ConflictResolveModal({ conflict, onClose }: ConflictResolveModalProps) {
  const {
    tour,
    user,
    resolveConflict,
    unresolveConflict,
    resolvedConflicts,
    getPendingConflictResolution,
    proposeConflictResolution,
    approvePendingConflictResolution,
    rejectPendingConflictResolution,
  } = useApp();
  const managerView = user.groupId === 'grp_mgmt' || user.groupId === 'grp_production';
  const [choiceIdx, setChoiceIdx] = useState<number | 'custom' | null>(null);
  const [customValue, setCustomValue] = useState('');
  const [note, setNote] = useState('');

  const existing = conflict ? resolvedConflicts.get(conflict.id) : undefined;
  const pending = conflict ? getPendingConflictResolution(conflict.id) : undefined;
  const pm = tour.riderImports[0]?.productionManager;

  // Reset form when conflict changes.
  useEffect(() => {
    if (!conflict) return;
    setChoiceIdx(null);
    setCustomValue('');
    setNote('');
  }, [conflict?.id]);

  if (!conflict) return null;

  const sevTone =
    conflict.severity === 'high' ? 'critical'
    : conflict.severity === 'medium' ? 'rehearsal'
    : 'neutral';

  const canSubmit = choiceIdx !== null && (choiceIdx !== 'custom' || customValue.trim().length > 0);

  const onSubmit = () => {
    if (choiceIdx === null) return;
    const chosen = choiceIdx === 'custom' ? customValue.trim() : conflict.values[choiceIdx]?.value ?? '';
    const source = choiceIdx === 'custom' ? 'TM override' : conflict.values[choiceIdx]?.section;
    if (managerView) {
      resolveConflict(conflict.id, { chosenValue: chosen, source, note: note.trim() || undefined });
      if (pending) rejectPendingConflictResolution(conflict.id);
    } else {
      proposeConflictResolution(conflict.id, { chosenValue: chosen, source, note: note.trim() || undefined });
    }
    onClose();
  };

  // Pre-fill an email to the PM with the conflict context.
  const mailtoHref = pm?.email
    ? `mailto:${pm.email}?subject=${encodeURIComponent(
        `Rider conflict: ${conflict.description.slice(0, 60)}`,
      )}&body=${encodeURIComponent(
        [
          `Hi ${pm.name?.split(' ')[0] ?? 'PM'},`,
          '',
          `Need a quick clarification on the rider — the sections disagree:`,
          '',
          ...conflict.values.map((v) => `${v.section}: ${v.value}`),
          '',
          conflict.suggestedResolution ? `Suggested: ${conflict.suggestedResolution}` : '',
          '',
          'Which is correct? Thanks.',
        ].filter(Boolean).join('\n'),
      )}`
    : undefined;
  const telHref = pm?.phone ? `tel:${pm.phone.replace(/\s/g, '')}` : undefined;

  return (
    <Modal
      open={!!conflict}
      onClose={onClose}
      eyebrow={`Rider conflict · ${conflict.type.replace('_', ' ')}`}
      title={
        existing ? 'Conflict already resolved'
        : pending ? (managerView ? 'Pending proposal' : 'Proposal awaiting approval')
        : 'Resolve this conflict'
      }
      size="lg"
    >
      <div className="space-y-4">
        {/* Severity + section pair */}
        <div className="flex items-center gap-2 flex-wrap">
          <Chip tone={sevTone} size="sm">{conflict.severity} severity</Chip>
          <span className="text-[11px] text-[var(--color-ink-3)]">between</span>
          <span className="inline-flex items-baseline gap-1 text-[12.5px] font-semibold">
            {conflict.sectionsInvolved.map((s, i) => (
              <span key={s} className="inline-flex items-baseline gap-1">
                {i > 0 && <span className="text-[var(--color-ink-4)]">↔</span>}
                <RiderRef section={s} />
              </span>
            ))}
          </span>
        </div>

        {/* Description */}
        <p className="text-[13px] text-[var(--color-ink)] leading-relaxed">
          {linkifyRiderRefs(conflict.description)}
        </p>

        {existing ? (
          /* RESOLVED */
          <div className="border border-[var(--color-rule)] rounded-[4px] p-4 bg-[var(--color-paper-2)]/40">
            <div className="flex items-center gap-2 mb-2">
              <Icon.Check size={14} className="text-[var(--color-moss)]" />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
                Resolved by {existing.resolvedBy} · {new Date(existing.resolvedAt).toLocaleString()}
              </span>
            </div>
            {existing.proposedAt && (
              <div className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--color-ink-3)] mb-2">
                Proposed by {existing.proposedAt.by} · {new Date(existing.proposedAt.at).toLocaleString()}
              </div>
            )}
            <div className="text-[13px] font-semibold text-[var(--color-ink)]">{existing.chosenValue}</div>
            {existing.source && (
              <div className="font-mono text-[10.5px] uppercase tracking-[0.10em] text-[var(--color-ink-3)] mt-1">
                Source: {existing.source}
              </div>
            )}
            {existing.note && (
              <div className="mt-2 text-[12px] text-[var(--color-ink-2)] leading-relaxed italic">
                "{existing.note}"
              </div>
            )}
            {managerView && (
              <button
                type="button"
                onClick={() => { unresolveConflict(conflict.id); onClose(); }}
                className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold rounded-[3px] border border-[var(--color-rule)] hover:border-[var(--color-ink-4)] text-[var(--color-ink-2)]"
              >
                Re-open conflict
              </button>
            )}
          </div>
        ) : pending ? (
          /* PENDING PROPOSAL */
          <div className="border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/6 rounded-[4px] p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Icon.Alert size={13} className="text-[var(--color-accent)]" />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-accent)]">
                {managerView ? 'Pending proposal' : 'Awaiting manager approval'}
              </span>
            </div>
            <div className="text-[13px] font-semibold text-[var(--color-ink)]">{pending.chosenValue}</div>
            {pending.source && (
              <div className="font-mono text-[10.5px] uppercase tracking-[0.10em] text-[var(--color-ink-3)]">
                Source: {pending.source}
              </div>
            )}
            {pending.note && (
              <div className="text-[12px] text-[var(--color-ink-2)] italic">"{pending.note}"</div>
            )}
            <div className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--color-ink-3)]">
              Proposed by {pending.proposedAt.by} · {new Date(pending.proposedAt.at).toLocaleString()}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => { rejectPendingConflictResolution(conflict.id); onClose(); }}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold rounded-[3px] border border-[var(--color-rule)] hover:border-[var(--color-ink-4)] text-[var(--color-ink-2)]"
              >
                {managerView ? 'Reject' : 'Cancel proposal'}
              </button>
              {managerView && (
                <button
                  type="button"
                  onClick={() => { approvePendingConflictResolution(conflict.id); onClose(); }}
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold rounded-[3px] bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]"
                >
                  <Icon.Check size={12} /> Approve
                </button>
              )}
            </div>
          </div>
        ) : (
          /* FORM — unresolved, no pending */
          <>
            {/* Choose a value */}
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] mb-2">
                Pick the correct value
              </div>
              <ul className="space-y-1.5">
                {conflict.values.map((v, i) => (
                  <li key={i}>
                    <ChoiceRow
                      label={v.section}
                      value={v.value}
                      selected={choiceIdx === i}
                      onSelect={() => setChoiceIdx(i)}
                    />
                  </li>
                ))}
                <li>
                  <ChoiceRow
                    label="Enter a different value"
                    selected={choiceIdx === 'custom'}
                    onSelect={() => setChoiceIdx('custom')}
                  >
                    <input
                      type="text"
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      onFocus={() => setChoiceIdx('custom')}
                      placeholder="What value should the system use?"
                      className="w-full h-8 px-2 text-[12.5px] rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-card)] mt-1.5 outline-none focus:border-[var(--color-ink-4)]"
                    />
                  </ChoiceRow>
                </li>
              </ul>
            </div>

            {/* Suggested */}
            {conflict.suggestedResolution && (
              <div className="border-l-2 border-[var(--color-day-rehearsal)] pl-3 py-1">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] mb-0.5">
                  Suggested
                </div>
                <p className="text-[12.5px] text-[var(--color-ink-2)] leading-relaxed">
                  {linkifyRiderRefs(conflict.suggestedResolution)}
                </p>
              </div>
            )}

            {/* Contact PM */}
            {pm?.name && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] mb-2">
                  Need to confirm with the production manager?
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {mailtoHref && (
                    <a
                      href={mailtoHref}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold rounded-[3px] border border-[var(--color-rule)] hover:border-[var(--color-ink-4)] text-[var(--color-ink)]"
                    >
                      <Icon.Document size={12} /> Email {pm.name.split(' ')[0]}
                    </a>
                  )}
                  {telHref && (
                    <a
                      href={telHref}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold rounded-[3px] border border-[var(--color-rule)] hover:border-[var(--color-ink-4)] text-[var(--color-ink)]"
                    >
                      <Icon.Clock size={12} /> Call {pm.phone}
                    </a>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--color-ink-3)] leading-relaxed">
                  The email button pre-fills a draft with the conflict context, so the PM can answer in one line.
                </p>
              </div>
            )}

            {/* Optional note */}
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] mb-1.5 block">
                Resolution note (optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Confirmed with Manuel by email — §8 is correct"
                className="w-full h-9 px-2.5 text-[12.5px] rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-card)] outline-none focus:border-[var(--color-ink-4)]"
              />
            </div>

            {/* Actions */}
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
                <Icon.Check size={13} /> {managerView ? 'Mark resolved' : 'Propose resolution'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function ChoiceRow({
  label,
  value,
  selected,
  onSelect,
  children,
}: {
  label: string;
  value?: string;
  selected: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-[4px] border transition-colors px-3 py-2.5',
        selected
          ? 'border-[var(--color-ink)] bg-[var(--color-paper-2)]/50'
          : 'border-[var(--color-rule)] hover:border-[var(--color-ink-4)]',
      )}
    >
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            'w-3 h-3 rounded-full border-[1.5px] shrink-0 mt-[3px]',
            selected ? 'border-[var(--color-ink)] bg-[var(--color-ink)]' : 'border-[var(--color-ink-4)]',
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--color-ink-3)]">
            {linkifyRiderRefs(label)}
          </div>
          {value && (
            <div className="text-[12.5px] text-[var(--color-ink)] mt-0.5 leading-snug">
              {value}
            </div>
          )}
          {children}
        </div>
      </div>
    </button>
  );
}
