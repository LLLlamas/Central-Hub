import { Outlet, useLocation } from 'react-router-dom';
import { CommandPaletteProvider } from '@/components/CommandPalette';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { ScratchBanner } from './ScratchBanner';
import { TourProvider } from '@/components/tour/TourProvider';
import { CoachMark } from '@/components/tour/CoachMark';
import { useApp } from '@/state/AppState';

export function Layout() {
  const loc = useLocation();
  const { booting } = useApp();
  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper)]">
        <div
          className="w-6 h-6 rounded-full border-2 border-[var(--color-rule)] border-t-[var(--color-ink)] animate-spin"
          role="status"
          aria-label="Loading your tour"
        />
      </div>
    );
  }
  return (
    <CommandPaletteProvider>
      <TourProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 min-w-0 flex flex-col">
            <TopBar />
            <ScratchBanner />
            <main key={loc.pathname} className="page-fade flex-1 px-4 py-5 pb-24 sm:px-5 md:px-6 md:py-8 md:pb-8 max-w-[1280px] w-full mx-auto">
              <Outlet />
            </main>
          </div>
          <BottomNav />
        </div>
        <CoachMark />
      </TourProvider>
    </CommandPaletteProvider>
  );
}
