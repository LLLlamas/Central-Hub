import { createBrowserRouter, Navigate, useParams } from 'react-router-dom';
import { tourPath } from '@/lib/routing';

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
import { TourScope } from '@/routes/TourScope';
import { TourNotFoundRedirect } from '@/routes/TourNotFoundRedirect';
import { LegacyPathRedirect } from '@/routes/LegacyPathRedirect';
import { MyTours } from '@/routes/MyTours';
import { TourOverview } from '@/routes/TourOverview';
import { CalendarPage } from '@/routes/Calendar';
import { DayDetail } from '@/routes/DayDetail';
import { Personnel } from '@/routes/Personnel';
import { ScheduleAndVisibility } from '@/routes/ScheduleAndVisibility';
import { DaySheets } from '@/routes/DaySheets';
import { DaySheetPrint } from '@/routes/DaySheetPrint';
import { FlightIngest } from '@/routes/FlightIngest';
import { RiderBuilder } from '@/routes/RiderBuilder';
import { Plots } from '@/routes/Plots';
import { Gear } from '@/routes/Gear';
import { Advance } from '@/routes/Advance';
import { AdvanceDetail } from '@/routes/AdvanceDetail';
import { AppUserPermissions } from '@/routes/AppUserPermissions';
import { MyTravelInfo } from '@/routes/MyTravelInfo';
import { SubmissionsInbox } from '@/routes/SubmissionsInbox';
import { More } from '@/routes/More';

// Old bookmarks/links pointed at `ingest/riders` (the upload-and-review
// surface). The rider now lives at the `rider` builder path — forward
// instead of breaking the old URL.
function RiderIngestRedirect() {
  const { tourId } = useParams<{ tourId: string }>();
  return <Navigate to={tourPath(tourId ?? '', 'rider')} replace />;
}

export const router = createBrowserRouter([
  { path: '/', element: <MyTours />, errorElement: <RouteErrorCard /> },
  {
    path: '/t/:tourId',
    element: <TourScope />,
    errorElement: <RouteErrorCard />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <TourOverview /> },
          { path: 'calendar', element: <CalendarPage /> },
          { path: 'calendar/:date', element: <DayDetail /> },
          { path: 'personnel', element: <Personnel /> },
          { path: 'plots', element: <Plots /> },
          { path: 'gear', element: <Gear /> },
          { path: 'advance', element: <Advance /> },
          { path: 'advance/:dayId', element: <AdvanceDetail /> },
          { path: 'schedule', element: <ScheduleAndVisibility /> },
          { path: 'access', element: <AppUserPermissions /> },
          { path: 'me', element: <MyTravelInfo /> },
          { path: 'submissions', element: <SubmissionsInbox /> },
          { path: 'daysheet', element: <DaySheets /> },
          { path: 'daysheet/:date', element: <DaySheets /> },
          { path: 'ingest/flights', element: <FlightIngest /> },
          { path: 'rider', element: <RiderBuilder /> },
          { path: 'ingest/riders', element: <RiderIngestRedirect /> },
          { path: 'more', element: <More /> },
          { path: '*', element: <TourNotFoundRedirect /> },
        ],
      },
      {
        path: 'print',
        element: <PrintLayout />,
        children: [{ path: 'daysheet/:date', element: <DaySheetPrint /> }],
      },
    ],
  },
  { path: '*', element: <LegacyPathRedirect /> },
]);
