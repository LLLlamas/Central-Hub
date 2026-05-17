import { Outlet, useLocation } from 'react-router-dom';
import { CommandPaletteProvider } from '@/components/CommandPalette';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';

export function Layout() {
  const loc = useLocation();
  return (
    <CommandPaletteProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <TopBar />
          <main key={loc.pathname} className="page-fade flex-1 px-4 py-5 pb-24 sm:px-5 md:px-6 md:py-8 md:pb-8 max-w-[1280px] w-full mx-auto">
            <Outlet />
          </main>
        </div>
        <BottomNav />
      </div>
    </CommandPaletteProvider>
  );
}
