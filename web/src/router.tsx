import { createBrowserRouter, Navigate } from 'react-router-dom';
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
import { More } from '@/routes/More';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <TourOverview /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'calendar/:date', element: <DayDetail /> },
      { path: 'personnel', element: <Personnel /> },
      { path: 'schedule', element: <ScheduleAndVisibility /> },
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
    children: [
      { path: 'daysheet/:date', element: <DaySheetPrint /> },
    ],
  },
]);
