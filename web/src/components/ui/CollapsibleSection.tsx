import { useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';

interface CollapsibleSectionProps {
  title: ReactNode;
  eyebrow?: string;
  /** Whether the section starts expanded. */
  defaultOpen?: boolean;
  /** Optional chip/status shown on the right of the header. */
  badge?: ReactNode;
  children: ReactNode;
}

/**
 * A card section that collapses to its header — keeps long pages (e.g. the
 * combined route + travel import page) from overwhelming the reader.
 */
export function CollapsibleSection({
  title,
  eyebrow,
  defaultOpen = true,
  badge,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className="card overflow-hidden"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer list-none flex items-center gap-3 px-5 py-3.5 select-none">
        <Icon.Chevron
          size={13}
          className={`shrink-0 text-[var(--color-ink-4)] transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <div className="flex-1 min-w-0">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <div className="text-[14px] font-semibold text-[var(--color-ink)]">{title}</div>
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </summary>
      <div className="border-t border-[var(--color-rule-soft)] p-5">{children}</div>
    </details>
  );
}
