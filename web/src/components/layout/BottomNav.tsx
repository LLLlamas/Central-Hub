import { NavLink } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

const tabs = [
  { to: '/', label: 'Today', icon: Icon.Home, end: true },
  { to: '/calendar', label: 'Calendar', icon: Icon.Calendar },
  { to: '/personnel', label: 'People', icon: Icon.Users },
  { to: '/more', label: 'More', icon: Icon.Settings },
];

export function BottomNav() {
  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-rule)] bg-[var(--color-paper)]/95 backdrop-blur">
      <div className="grid grid-cols-4 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
        {tabs.map((tab) => {
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
