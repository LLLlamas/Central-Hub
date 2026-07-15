import { Link } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { tourPath } from '@/lib/routing';
import { isVenuePersona, VENUE_VISIBLE_ROUTES } from '@/lib/access';

const tools = [
  { to: '/', label: 'My Shows', hint: 'Leave this tour and return to your full list of shows.', icon: Icon.Grid },
  { to: 'me', label: 'My Travel & Info', hint: 'Your flights, hotel, schedule, and plots — and submit a document for review.', icon: Icon.User },
  { to: 'daysheet', label: 'Day sheets', hint: 'Edit, personalize, print, and publish daily sheets.', icon: Icon.Document },
  { to: 'gear', label: 'Supplies & Costs', hint: 'Rider supplies, flight costs, and hotel costs — status, cost estimates, and links to source documents.', icon: Icon.Package },
  { to: 'advance', label: 'Venue advance', hint: "Send the rider to each show's venue and track their answers until every item is confirmed.", icon: Icon.Handshake },
  { to: 'plots', label: 'Plots', hint: 'Stage plot and lightplot pages pulled out of the rider.', icon: Icon.Image },
  { to: 'submissions', label: 'Submissions', hint: 'Review documents your crew sent in — approve or reject. TM and PM only.', icon: Icon.Inbox, managerOnly: true },
  { to: 'schedule', label: 'Schedule Permissions', hint: 'Control who sees or owns each call time. TM and PM only.', icon: Icon.Layers, managerOnly: true },
  { to: 'access', label: 'App User Permissions', hint: 'Manage who can open the app, assign roles and groups, revoke access. TM and PM only.', icon: Icon.Lock, managerOnly: true },
  { to: 'rider', label: 'Rider', hint: 'Author the tech rider from a template, or import a PDF instead.', icon: Icon.Sparkle, managerOnly: true },
  { to: 'ingest/flights', label: 'Import route & hotels', hint: 'Import the tour route, then review hotel bookings.', icon: Icon.MapPin, managerOnly: true },
];

export function More() {
  const { tour, user } = useApp();
  const managerView = user.groupId === 'grp_mgmt' || user.groupId === 'grp_production';
  const venuePersona = isVenuePersona(user);
  // A grp_venue persona is single-purpose: only the advance board and the
  // tour-exit "My Shows" link ('/') stay visible — every manager/crew tool is hidden.
  const visible = tools.filter(
    (t) => (!t.managerOnly || managerView) && (!venuePersona || t.to === '/' || VENUE_VISIBLE_ROUTES.has(t.to)),
  );
  return (
    <div>
      <PageHeader
        title="More"
        description="Power tools and settings live here so mobile can stay focused on the day."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((tool) => {
          const I = tool.icon;
          return (
            <Link
              key={tool.to}
              to={tool.to === '/' ? '/' : tourPath(tour.id, tool.to)}
              className="card p-4 min-h-[92px] flex items-start gap-3 lift"
            >
              <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-[4px] bg-[var(--color-paper-2)] text-[var(--color-ink-2)] shrink-0">
                <I size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-[var(--color-ink)]">{tool.label}</span>
                <span className="mt-1 block text-[12.5px] leading-snug text-[var(--color-ink-3)]">{tool.hint}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
