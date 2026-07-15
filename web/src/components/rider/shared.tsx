import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

// Small building blocks shared by the inline-editable rider-authoring
// surfaces (BacklineEditor / CateringEditor / LodgingEditor). Extracted here
// because all three editors need the exact same "eyebrow" field label, the
// same chip-list-with-add-input control for preferred/excluded brand and
// amenity tags, and the same icon-only "remove this row" button — pulling
// them into one module keeps the three editors from drifting out of sync.

export function Label({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow mb-0.5">{children}</div>;
}

/** Chip list with per-tag remove + a small add input. Used for preferred/excluded
 *  brand lists, dietary tags, and required amenities. */
export function TagListEditor({
  tags,
  onChange,
  placeholder,
  critical = false,
  disabled = false,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  critical?: boolean;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');

  const commitDraft = () => {
    const v = draft.trim();
    if (v.length === 0) return;
    onChange([...tags, v]);
    setDraft('');
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((t, i) => (
        <span
          key={i}
          className={cn(
            'inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-[2px] text-[10.5px] font-medium',
            critical
              ? 'border-[rgba(184,57,43,0.35)] bg-[rgba(184,57,43,0.06)] text-[var(--color-accent)]'
              : 'border-[var(--color-rule-soft)] bg-[var(--color-paper-2)]/40 text-[var(--color-ink-2)]',
          )}
        >
          {critical && <Icon.X size={8} />}
          {t}
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(tags.filter((_, idx) => idx !== i))}
              title={`Remove ${t}`}
              className="hover:text-[var(--color-accent)]"
            >
              <Icon.X size={9} />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitDraft();
            }
          }}
          onBlur={commitDraft}
          className="min-w-[70px] flex-1 bg-transparent rounded-[2px] px-1 py-0.5 text-[11px] outline-none border border-transparent hover:border-[var(--color-rule)] focus:border-[var(--color-ocean)] focus:bg-[var(--color-card)]"
        />
      )}
    </div>
  );
}

/** Icon-only "remove this row" button — a table/list row's trailing X. */
export function RemoveRowButton({
  onClick,
  disabled,
  title,
  size = 11,
  shrink = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  size?: number;
  shrink?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'text-[var(--color-ink-3)] hover:text-[var(--color-accent)] disabled:opacity-40 disabled:hover:text-[var(--color-ink-3)]',
        shrink && 'shrink-0',
      )}
    >
      <Icon.X size={size} />
    </button>
  );
}
