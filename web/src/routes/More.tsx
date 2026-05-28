import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { Chip } from '@/components/ui/Chip';
import { MOCK_TODAY } from '@/lib/today';
import { fmtDate } from '@/lib/format';

const tools = [
  { to: '/daysheet', label: 'Day sheets', hint: 'Edit, personalize, print, and publish daily sheets.', icon: Icon.Document },
  { to: '/plots', label: 'Plots', hint: 'Stage plot and lightplot pages pulled out of the rider.', icon: Icon.Image },
  { to: '/schedule', label: 'Schedule Permissions', hint: 'Control who sees or owns each call time. TM and PM only.', icon: Icon.Layers },
  { to: '/ingest/riders', label: 'Import rider', hint: 'Review the extracted rider sections and conflicts.', icon: Icon.Sparkle },
  { to: '/ingest/flights', label: 'Import route & travel', hint: 'Import the tour route, then review parsed flight confirmations.', icon: Icon.Plane },
];

export function More() {
  return (
    <div>
      <PageHeader
        title="More"
        description="Power tools and settings live here so mobile can stay focused on the day."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="mock" variant="outline">
              Demo date: {fmtDate(MOCK_TODAY, 'MMM d, yyyy')}
            </Chip>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => {
          const I = tool.icon;
          return (
            <Link
              key={tool.to}
              to={tool.to}
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
