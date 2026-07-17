import { NavLink } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import { isVenuePersona, isReviewPersona } from '@/lib/access';

const tabs = [
  { to: '', label: 'Today', icon: Icon.Home, end: true },
  { to: 'calendar', label: 'Calendar', icon: Icon.Calendar },
  { to: 'personnel', label: 'People', icon: Icon.Users },
  { to: 'more', label: 'More', icon: Icon.Settings },
];

// A grp_venue persona is single-purpose: swap the whole tab bar for just the
// advance board rather than filtering the standard tabs down (the tour-exit
// "My Tours" link still shows — it lives ungated in TopBar, not here).
const venueTabs = [{ to: 'advance', label: 'Advance', icon: Icon.Handshake, end: true }];

// Same idea for the rider-review persona — single-purpose, just the rider.
const reviewTabs = [{ to: 'rider', label: 'Rider', icon: Icon.Sparkle, end: true }];

export function BottomNav() {
  const { user } = useApp();
  const visibleTabs = isVenuePersona(user) ? venueTabs : isReviewPersona(user) ? reviewTabs : tabs;

  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-rule)] bg-[var(--color-paper)]/95 backdrop-blur">
      <div
        className={cn(
          'grid px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5',
          visibleTabs.length === 1 ? 'grid-cols-1' : 'grid-cols-4',
        )}
      >
        {visibleTabs.map((tab) => {
          const I = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'min-h-14 rounded-[4px] flex flex-col items-center justify-center gap-1 text-[10.5px] font-semibold transition-colors',
                  isActive
                    ? 'text-[var(--color-accent)] bg-[var(--color-card)]'
                    : 'text-[var(--color-ink-3)] hover:text-[var(--color-ink)]',
                )
              }
            >
              <I size={18} />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
