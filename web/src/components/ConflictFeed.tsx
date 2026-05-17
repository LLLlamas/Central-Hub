import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Chip } from '@/components/ui/Chip';
import { SectionCard } from '@/components/ui/Card';
import { SourceTag } from '@/components/provenance/SourceTag';
import { RiderRef, linkifyRiderRefs } from '@/components/RiderRef';
import { ConflictResolveModal } from '@/components/ConflictResolveModal';
import { ConflictExplain } from '@/components/ExplainTag';
import { useApp } from '@/state/AppState';
import { getAllConflicts } from '@/data/mockTour';
import { cn } from '@/lib/cn';
import type { Conflict } from '@/types';

/**
 * Top-level rider conflict feed. Lists every contradiction the detector
 * found across the rider PDF, organized as unresolved vs resolved, with
 * a Resolve → action per row that opens the resolution flow.
 */
export function ConflictFeed({ limit, compact = false }: { limit?: number; compact?: boolean }) {
  const { resolvedConflicts } = useApp();
  const [active, setActive] = useState<Conflict | null>(null);

  const all = getAllConflicts();
  const unresolved = all.filter((c) => !resolvedConflicts.has(c.id));
  const resolved = all.filter((c) => resolvedConflicts.has(c.id));

  const titleNode = (
    <span className="inline-flex items-baseline gap-1.5">
      Rider conflicts
      <SourceTag
        source="rider_conflicts_derived"
        field="Rider conflicts — real findings"
      />
    </span>
  );

  if (all.length === 0) {
    return (
      <SectionCard title={titleNode} eyebrow="All clear">
        <p className="text-[12.5px] text-[var(--color-ink-3)]">
          The conflict detector found no contradictions in the current rider.
        </p>
      </SectionCard>
    );
  }

  const visibleUnresolved = typeof limit === 'number' ? unresolved.slice(0, limit) : unresolved;
  const hiddenUnresolved = typeof limit === 'number' ? Math.max(0, unresolved.length - limit) : 0;

  return (
    <>
      <SectionCard
        title={titleNode}
        eyebrow={
          <span className="inline-flex items-baseline gap-2">
            <span>{unresolved.length} unresolved</span>
            {resolved.length > 0 && (
              <span className="text-[var(--color-moss)]">· {resolved.length} resolved</span>
            )}
          </span>
        }
        action={
          <Link
            to="/ingest/riders"
            className="text-[12px] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
          >
            Review all →
          </Link>
        }
      >
        {/* Intro / help text */}
        <div className={cn('mb-3 -mt-2', compact ? 'text-[11.5px]' : 'text-[12px]')}>
          <p className="text-[var(--color-ink-3)] leading-relaxed">
            These are real contradictions inside the rider PDF — the detector
            compares claims between sections (e.g., "Stage specs" vs "Lighting
            equipment") and flags disagreements. Click any{' '}
            <span className="font-mono text-[var(--color-ocean)]">p.N</span>{' '}
            link to open that section in the PDF. Click <strong>Resolve</strong>{' '}
            on a row to record which value is correct.
          </p>
        </div>

        {/* Unresolved list */}
        {unresolved.length === 0 ? (
          <div className="px-2 py-6 text-center">
            <Icon.Check size={20} className="text-[var(--color-moss)] mx-auto mb-1" />
            <p className="text-[12.5px] text-[var(--color-ink-3)]">
              All conflicts resolved. Nothing left to triage.
            </p>
          </div>
        ) : (
          <ul className={cn('divide-y divide-[var(--color-rule-soft)]', compact ? '-mx-4' : '-mx-6')}>
            {visibleUnresolved.map((c) => (
              <ConflictRow
                key={c.id}
                conflict={c}
                compact={compact}
                onResolve={() => setActive(c)}
              />
            ))}
          </ul>
        )}

        {hiddenUnresolved > 0 && (
          <div className="pt-2 mt-2 text-[11.5px] text-[var(--color-ink-3)] text-center border-t border-[var(--color-rule-soft)]">
            + {hiddenUnresolved} more unresolved — <Link to="/ingest/riders" className="underline">review all</Link>
          </div>
        )}

        {/* Resolved list — collapsed accordion */}
        {resolved.length > 0 && (
          <ResolvedConflicts
            conflicts={resolved}
            compact={compact}
            onReopen={(c) => setActive(c)}
          />
        )}
      </SectionCard>

      <ConflictResolveModal conflict={active} onClose={() => setActive(null)} />
    </>
  );
}

function ConflictRow({
  conflict,
  compact,
  onResolve,
}: {
  conflict: Conflict;
  compact: boolean;
  onResolve: () => void;
}) {
  const sevColor =
    conflict.severity === 'high'
      ? 'var(--color-accent)'
      : conflict.severity === 'medium'
      ? 'var(--color-gold)'
      : 'var(--color-ink-4)';
  const sevTone =
    conflict.severity === 'high' ? 'critical'
    : conflict.severity === 'medium' ? 'rehearsal'
    : 'neutral';
  return (
    <li className={cn('flex items-start gap-3', compact ? 'px-4 py-3' : 'px-6 py-3.5')}>
      <Icon.Alert size={14} style={{ color: sevColor }} className="mt-[3px] shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <Chip tone={sevTone} size="sm" variant="outline">
              {conflict.severity}
            </Chip>
            <span className="text-[11px] text-[var(--color-ink-3)]">between</span>
            <span className="inline-flex items-baseline gap-1 text-[12.5px] font-semibold">
              {conflict.sectionsInvolved.map((s, i) => (
                <span key={s} className="inline-flex items-baseline gap-1">
                  {i > 0 && <span className="mx-0.5 text-[var(--color-ink-4)]">↔</span>}
                  <RiderRef section={s} />
                </span>
              ))}
            </span>
          </div>
          <button
            type="button"
            onClick={onResolve}
            className="inline-flex items-center gap-1 h-7 px-2.5 text-[11.5px] font-semibold rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-card)] hover:border-[var(--color-ink-4)] text-[var(--color-ink)] shrink-0"
          >
            Resolve <Icon.Arrow size={11} />
          </button>
        </div>
        <p className="text-[12.5px] text-[var(--color-ink)] leading-snug">
          {linkifyRiderRefs(conflict.description)}
          <ConflictExplain conflict={conflict} />
        </p>
        {conflict.suggestedResolution && (
          <p className="mt-1 text-[11.5px] text-[var(--color-ink-3)] leading-relaxed">
            <span className="font-mono uppercase tracking-[0.10em] text-[10px] text-[var(--color-ink-4)]">
              Suggestion:
            </span>{' '}
            {linkifyRiderRefs(conflict.suggestedResolution)}
          </p>
        )}
      </div>
    </li>
  );
}

function ResolvedConflicts({
  conflicts,
  compact,
  onReopen,
}: {
  conflicts: Conflict[];
  compact: boolean;
  onReopen: (c: Conflict) => void;
}) {
  const { resolvedConflicts } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('mt-3 pt-3 border-t border-[var(--color-rule-soft)]', compact ? '-mx-4 px-4' : '-mx-6 px-6')}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-[11.5px] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
      >
        <Icon.Chevron
          size={11}
          className={cn('transition-transform', open && 'rotate-90')}
        />
        {conflicts.length} resolved
        <span className="font-mono uppercase tracking-[0.10em] text-[9.5px] text-[var(--color-moss)]">
          ✓
        </span>
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5">
          {conflicts.map((c) => {
            const res = resolvedConflicts.get(c.id)!;
            return (
              <li key={c.id} className="flex items-baseline gap-3 text-[11.5px]">
                <Icon.Check size={11} className="text-[var(--color-moss)] mt-[2px] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="line-through text-[var(--color-ink-3)] truncate">
                    {c.description}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--color-ink-4)]">
                    Resolved by {res.resolvedBy} → {res.chosenValue}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onReopen(c)}
                  className="text-[11px] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
                >
                  View
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
