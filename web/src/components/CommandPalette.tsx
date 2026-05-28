import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { Icon } from '@/components/ui/Icon';
import { mockVenues } from '@/data/mockVenues';
import { fmtDate, dayTypeLabel } from '@/lib/format';
import type { Tour } from '@/types';
import { cn } from '@/lib/cn';

// ============================================================
// Context — exposes open()/close() so TopBar or other surfaces
// can trigger the palette without re-implementing the keyboard
// handler.
// ============================================================

interface PaletteCtx {
  open: boolean;
  setOpen: (b: boolean) => void;
}

const Ctx = createContext<PaletteCtx | null>(null);

export function useCommandPalette(): PaletteCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCommandPalette outside provider');
  return v;
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // Global ⌘K / Ctrl+K toggle.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <Ctx.Provider value={{ open, setOpen }}>
      {children}
      <CommandPalette />
    </Ctx.Provider>
  );
}

// ============================================================
// Index + filter
// ============================================================

type ItemType = 'page' | 'day' | 'person' | 'venue' | 'schedule';

interface PaletteItem {
  type: ItemType;
  label: string;
  sublabel?: string;
  to: string;
  keywords: string[];
}

function buildIndex(tour: Tour): PaletteItem[] {
  const items: PaletteItem[] = [];

  // Top-level pages.
  const pages: PaletteItem[] = [
    { type: 'page', label: 'Today', to: '/', keywords: ['home', 'dashboard', 'overview'] },
    { type: 'page', label: 'Calendar', to: '/calendar', keywords: ['dates'] },
    { type: 'page', label: 'People', to: '/personnel', keywords: ['personnel', 'crew', 'roster'] },
    { type: 'page', label: 'Plots', to: '/plots', keywords: ['plot', 'plots', 'stage plot', 'lightplot', 'cad', 'rider images', 'drawings'] },
    { type: 'page', label: 'Schedule Permissions', to: '/schedule', keywords: ['visibility', 'abac', 'permissions', 'schedule'] },
    { type: 'page', label: 'Day Sheets', to: '/daysheet', keywords: ['day sheet'] },
    { type: 'page', label: 'More', to: '/more', keywords: ['tools', 'settings'] },
    { type: 'page', label: 'Import route & travel', to: '/ingest/flights', keywords: ['flight', 'route', 'travel', 'csv', 'ingest'] },
    { type: 'page', label: 'Import rider', to: '/ingest/riders', keywords: ['rider', 'pdf', 'conflicts', 'ingest'] },
  ];
  items.push(...pages);

  // Days.
  for (const d of tour.days) {
    const label = `${fmtDate(d.date, 'EEE, MMM d')}${d.city ? ` · ${d.city}` : ''}`;
    items.push({
      type: 'day',
      label,
      sublabel: dayTypeLabel(d.dayType),
      to: d.dayType === 'show' || d.dayType === 'promo' ? `/daysheet/${d.date}` : `/calendar/${d.date}`,
      keywords: [d.date, d.city ?? '', d.country ?? '', d.dayType],
    });
  }

  // Personnel.
  for (const p of tour.personnel) {
    items.push({
      type: 'person',
      label: p.person.name,
      sublabel: p.role,
      to: '/personnel',
      keywords: [p.person.name, p.role],
    });
  }

  // Schedule items.
  for (const si of tour.scheduleItems) {
    const day = tour.days.find((d) => d.id === si.dayId);
    if (!day) continue;
    items.push({
      type: 'schedule',
      label: si.title,
      sublabel: `${fmtDate(day.date, 'MMM d')} · ${si.startTime}${si.endTime ? ` → ${si.endTime}` : ''}${si.location ? ` · ${si.location}` : ''}`,
      to: `/daysheet/${day.date}`,
      keywords: [si.title, si.location ?? '', si.type, day.date],
    });
  }

  // Venues.
  for (const [vid, v] of Object.entries(mockVenues)) {
    const day = tour.days.find((d) => d.venueId === vid);
    items.push({
      type: 'venue',
      label: v.name,
      sublabel: `${v.city}${day ? ` · ${fmtDate(day.date, 'MMM d')}` : ''}`,
      to: day ? `/daysheet/${day.date}` : '/calendar',
      keywords: [v.name, v.city, v.promoter ?? '', v.country],
    });
  }

  return items;
}

function filter(items: PaletteItem[], query: string): PaletteItem[] {
  if (!query.trim()) {
    // Empty query → show a curated top-of-list (pages first, then days, then a few crew).
    return items
      .filter((i) => i.type === 'page')
      .concat(items.filter((i) => i.type === 'day').slice(0, 8))
      .concat(items.filter((i) => i.type === 'person').slice(0, 4));
  }
  const q = query.toLowerCase().trim();
  return items
    .map((i) => {
      const label = i.label.toLowerCase();
      const sub = i.sublabel?.toLowerCase() ?? '';
      const kws = i.keywords.map((k) => k.toLowerCase());
      let score = 0;
      if (label.startsWith(q)) score = 4;
      else if (label.includes(q)) score = 3;
      else if (sub.includes(q)) score = 2;
      else if (kws.some((k) => k.includes(q))) score = 1;
      return { i, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i.label.length - b.i.label.length)
    .slice(0, 30)
    .map((x) => x.i);
}

// ============================================================
// Palette UI
// ============================================================

const TYPE_META: Record<ItemType, { label: string; iconChar: string; color: string }> = {
  page: { label: 'PAGE', iconChar: '◰', color: 'var(--color-ink-3)' },
  day: { label: 'DAY', iconChar: '▣', color: 'var(--color-day-show)' },
  person: { label: 'PERSON', iconChar: '●', color: 'var(--color-gold)' },
  venue: { label: 'VENUE', iconChar: '▾', color: 'var(--color-moss)' },
  schedule: { label: 'ITEM', iconChar: '⏱', color: 'var(--color-ocean)' },
};

function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const { tour } = useApp();
  const navigate = useNavigate();

  const items = useMemo(() => buildIndex(tour), [tour]);
  const results = useMemo(() => filter(items, query), [items, query]);

  // Reset state every time the palette opens.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
    }
  }, [open]);

  // Clamp active index when the result list shortens.
  useEffect(() => {
    setActiveIdx((i) => Math.min(i, Math.max(0, results.length - 1)));
  }, [results.length]);

  // Scroll the active row into view as the user arrows through.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const select = (idx: number) => {
    const r = results[idx];
    if (!r) return;
    navigate(r.to);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(activeIdx);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  if (!open) return null;
  if (typeof window === 'undefined' || !document.body) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close command palette"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-[rgba(21,19,15,0.45)] backdrop-blur-[2px]"
      />

      <div className="relative w-full max-w-[580px] bg-[var(--color-card)] border border-[var(--color-rule)] rounded-[6px] shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-[var(--color-rule-soft)]">
          <Icon.Search size={15} className="text-[var(--color-ink-3)] shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Jump to day, person, venue, or schedule item…"
            className="flex-1 bg-transparent outline-none text-[14px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-4)]"
          />
          <kbd className="font-mono text-[10px] tabular text-[var(--color-ink-4)] px-1.5 py-0.5 border border-[var(--color-rule)] rounded">
            esc
          </kbd>
        </div>

        {/* Results */}
        {results.length === 0 ? (
          <div className="px-4 py-10 text-center text-[12.5px] text-[var(--color-ink-3)]">
            No matches for <em className="text-[var(--color-ink)]">{query}</em>
          </div>
        ) : (
          <ul ref={listRef} className="max-h-[55vh] overflow-y-auto py-1">
            {results.map((r, i) => (
              <ResultRow
                key={`${r.type}:${r.to}:${i}`}
                item={r}
                idx={i}
                active={i === activeIdx}
                onHover={() => setActiveIdx(i)}
                onSelect={() => select(i)}
              />
            ))}
          </ul>
        )}

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--color-rule-soft)] flex items-center gap-4 text-[10px] font-mono uppercase tracking-[0.10em] text-[var(--color-ink-4)]">
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1 py-0.5 border border-[var(--color-rule)] rounded font-mono">↑↓</kbd>
            navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1 py-0.5 border border-[var(--color-rule)] rounded font-mono">↵</kbd>
            select
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <kbd className="px-1 py-0.5 border border-[var(--color-rule)] rounded font-mono">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ResultRow({
  item,
  idx,
  active,
  onHover,
  onSelect,
}: {
  item: PaletteItem;
  idx: number;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  const meta = TYPE_META[item.type];
  return (
    <li>
      <button
        type="button"
        data-idx={idx}
        onMouseEnter={onHover}
        onClick={onSelect}
        className={cn(
          'w-full text-left px-4 py-2 flex items-center gap-3 transition-colors',
          active
            ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
            : 'hover:bg-[var(--color-paper-2)] text-[var(--color-ink)]',
        )}
      >
        <span
          className="font-mono text-[14px] leading-none w-4 text-center shrink-0"
          style={{ color: active ? 'var(--color-paper)' : meta.color }}
          aria-hidden
        >
          {meta.iconChar}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold truncate">{item.label}</div>
          {item.sublabel && (
            <div
              className={cn(
                'text-[11px] truncate',
                active ? 'text-[var(--color-paper)]/80' : 'text-[var(--color-ink-3)]',
              )}
            >
              {item.sublabel}
            </div>
          )}
        </div>
        <span
          className={cn(
            'font-mono text-[9px] tracking-[0.14em] uppercase shrink-0',
            active ? 'text-[var(--color-paper)]/70' : 'text-[var(--color-ink-4)]',
          )}
        >
          {meta.label}
        </span>
      </button>
    </li>
  );
}
