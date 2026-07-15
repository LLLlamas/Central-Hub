import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Shared selectable-row chrome for "pick one of these options" lists — the
 * bordered/highlighted button + selection-circle marker used by
 * ReconcileModal's reconcile actions and ConflictResolveModal's value
 * choices. Those two modals stay separate (different resolved/pending/form
 * branching), but this inner row was a verbatim copy-paste; only the content
 * differs (a plain label vs. a section tag + value line), so callers supply
 * that as `children` and this owns just the outer shell + circle.
 */
export function SelectableRow({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
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
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </button>
  );
}
