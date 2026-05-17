import { Outlet } from 'react-router-dom';

/**
 * A bare layout for print-optimized routes. No sidebar, no topbar,
 * no app chrome. The route renders directly so the page can be
 * printed (Cmd/Ctrl+P) or rendered server-side to PDF.
 */
export function PrintLayout() {
  return (
    <div className="print-root min-h-screen bg-[var(--color-paper)] print:bg-white">
      <Outlet />
    </div>
  );
}
