import { createBrowserRouter, Navigate } from 'react-router-dom';

// Friendly fallback for any render-time error — a live demo should never show
// React Router's raw "Unexpected Application Error!" page.
function RouteErrorCard() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper)] p-6">
      <div className="card max-w-md w-full bg-[var(--color-card)] p-6 text-center">
        <div className="eyebrow">Something went wrong</div>
        <h1 className="mt-2 font-display text-[24px] font-bold text-[var(--color-ink)]">
          This page hit a snag
        </h1>
        <p className="mt-2 text-[13px] text-[var(--color-ink-3)] leading-relaxed">
          Your tour data is safe. Head back to the overview and try again.
        </p>
        <a
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-semibold rounded-[4px] bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]"
        >
          Back to overview
        </a>
      </div>
    </div>
  );
}
import { Layout } from '@/components/layout/Layout';
import { PrintLayout } from '@/components/layout/PrintLayout';
import { TourOverview } from '@/routes/TourOverview';
import { CalendarPage } from '@/routes/Calendar';
import { DayDetail } from '@/routes/DayDetail';
import { Personnel } from '@/routes/Personnel';
import { ScheduleAndVisibility } from '@/routes/ScheduleAndVisibility';
import { DaySheets } from '@/routes/DaySheets';
import { DaySheetPrint } from '@/routes/DaySheetPrint';
import { FlightIngest } from '@/routes/FlightIngest';
import { RiderIngest } from '@/routes/RiderIngest';
import { Plots } from '@/routes/Plots';
import { Gear } from '@/routes/Gear';
import { AppUserPermissions } from '@/routes/AppUserPermissions';
import { MyTravelInfo } from '@/routes/MyTravelInfo';
import { SubmissionsInbox } from '@/routes/SubmissionsInbox';
import { More } from '@/routes/More';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteErrorCard />,
    children: [
      { index: true, element: <TourOverview /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'calendar/:date', element: <DayDetail /> },
      { path: 'personnel', element: <Personnel /> },
      { path: 'plots', element: <Plots /> },
      { path: 'gear', element: <Gear /> },
      { path: 'schedule', element: <ScheduleAndVisibility /> },
      { path: 'access', element: <AppUserPermissions /> },
      { path: 'me', element: <MyTravelInfo /> },
      { path: 'submissions', element: <SubmissionsInbox /> },
      { path: 'daysheet', element: <DaySheets /> },
      { path: 'daysheet/:date', element: <DaySheets /> },
      { path: 'ingest/flights', element: <FlightIngest /> },
      { path: 'ingest/riders', element: <RiderIngest /> },
      { path: 'more', element: <More /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
  {
    path: '/print',
    element: <PrintLayout />,
    errorElement: <RouteErrorCard />,
    children: [
      { path: 'daysheet/:date', element: <DaySheetPrint /> },
    ],
  },
]);
