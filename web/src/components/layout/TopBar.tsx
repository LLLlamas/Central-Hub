import { useState } from 'react';
import { useApp } from '@/state/AppState';
import { useCommandPalette } from '@/components/CommandPalette';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

export function TopBar() {
  const { user, userKey, setUserKey, allUsers, tour } = useApp();
  const [open, setOpen] = useState(false);
  const palette = useCommandPalette();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="sticky top-0 z-30 bg-[var(--color-paper)]/95 backdrop-blur border-b border-[var(--color-rule)]">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 md:gap-4 md:px-6 md:py-3">
        <div className="flex items-center gap-2 min-w-0 flex-1 md:max-w-lg">
          <button
            type="button"
            onClick={() => palette.setOpen(true)}
            className="group relative h-11 w-11 shrink-0 pl-0 pr-0 flex items-center justify-center gap-2 text-left text-[13px] font-medium rounded-[4px] bg-[var(--color-paper-2)]/70 border border-transparent hover:border-[var(--color-rule)] hover:bg-[var(--color-card)] transition-colors text-[var(--color-ink-4)] sm:w-full sm:flex-1 sm:justify-start sm:pl-8 sm:pr-2 md:h-9"
            title="Jump to anything"
            aria-label="Jump to anything"
          >
            <Icon.Search
              size={14}
              className="sm:absolute sm:left-2.5 sm:top-1/2 sm:-translate-y-1/2 text-[var(--color-ink-4)]"
            />
            <span className="hidden sm:block flex-1 truncate">Jump to anything in {tour.name}...</span>
            <kbd className="hidden md:inline-flex font-mono text-[10px] tabular text-[var(--color-ink-3)] px-1.5 py-0.5 border border-[var(--color-rule)] rounded bg-[var(--color-card)] shrink-0">
              {isMac ? 'Cmd' : 'Ctrl'} K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2.5 h-11 md:h-9 pl-1.5 pr-2.5 rounded-[4px] border border-[var(--color-rule)] hover:border-[var(--color-ink-4)] transition-colors bg-[var(--color-card)]"
              title="Switch viewer"
            >
              <span
                className="inline-flex items-center justify-center w-7 h-7 md:w-6 md:h-6 rounded-full text-[10px] font-mono font-bold text-[var(--color-paper)]"
                style={{ background: 'var(--color-ink)' }}
              >
                {initials(user.name)}
              </span>
              <div className="hidden sm:block text-left leading-tight">
                <div className="text-[12px] font-semibold text-[var(--color-ink)]">{user.name}</div>
                <div className="text-[10.5px] text-[var(--color-ink-3)]">{user.role}</div>
              </div>
              <Icon.ChevronDown size={14} className="text-[var(--color-ink-4)]" />
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-1.5 w-[min(280px,calc(100vw-1.5rem))] rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-card)] shadow-lg overflow-hidden">
                <div className="px-3 pt-3 pb-2 border-b border-[var(--color-rule-soft)]">
                  <div className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--color-ink-3)]">
                    Viewer switcher
                  </div>
                  <p className="mt-1 text-[11.5px] text-[var(--color-ink-3)] leading-snug">
                    Visibility is per-person. Switch viewer to see the same day as the TM, FOH engineer, artist, etc.
                  </p>
                </div>
                <ul className="py-1">
                  {Object.entries(allUsers).map(([key, u]) => (
                    <li key={key}>
                      <button
                        onClick={() => {
                          setUserKey(key as typeof userKey);
                          setOpen(false);
                        }}
                        className={cn(
                          'w-full text-left flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--color-paper-2)] transition-colors',
                          key === userKey && 'bg-[var(--color-paper-2)]',
                        )}
                      >
                        <span
                          className="inline-flex items-center justify-center w-7 h-7 md:w-6 md:h-6 rounded-full text-[10px] font-mono font-bold text-[var(--color-paper)]"
                          style={{ background: 'var(--color-ink-2)' }}
                        >
                          {initials(u.name)}
                        </span>
                        <div className="flex-1 leading-tight">
                          <div className="text-[12.5px] font-semibold text-[var(--color-ink)]">
                            {u.name}
                          </div>
                          <div className="text-[10.5px] text-[var(--color-ink-3)]">{u.role}</div>
                        </div>
                        {key === userKey && <Icon.Check size={14} className="text-[var(--color-accent)]" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
