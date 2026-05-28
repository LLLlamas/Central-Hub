import { useNavigate } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { SourceTag } from '@/components/provenance/SourceTag';
import { PlotCard, collectAllPlots } from '@/routes/RiderIngest';

export function Plots() {
  const { tour } = useApp();
  const navigate = useNavigate();
  const imp = tour.riderImports[0];
  const plots = imp ? collectAllPlots(imp) : [];

  if (!imp || plots.length === 0) {
    return (
      <div>
        <PageHeader
          eyebrow="Plots"
          title="Plots"
          description="Stage plot and lightplot pages pulled out of the rider so you can find them without scrolling past every CAD sheet."
        />
        <Card>
          <div className="py-12 flex flex-col items-center text-center gap-3">
            <Icon.Image size={28} className="text-[var(--color-ink-4)]" />
            <div>
              <p className="text-[13.5px] font-semibold text-[var(--color-ink)]">No plots yet</p>
              <p className="mt-1 text-[12px] text-[var(--color-ink-3)] max-w-md">
                Import a rider with stage plot or lightplot pages and they will show up here. The parser flags image-only pages and attaches them to their owning section.
              </p>
            </div>
            <Button
              variant="primary"
              leading={<Icon.Sparkle size={14} />}
              onClick={() => navigate('/ingest/riders')}
            >
              Import rider
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={`${plots.length} image${plots.length === 1 ? '' : 's'} from ${imp.filename}`}
        title={
          <span className="inline-flex items-baseline gap-1">
            Plots
            <SourceTag source="rider_plots" field="Stage plot & lightplot" />
          </span>
        }
        description="Click any thumbnail to open its source page in the in-app viewer."
        actions={
          <Button
            variant="outline"
            leading={<Icon.Sparkle size={14} />}
            onClick={() => navigate('/ingest/riders')}
          >
            View rider
          </Button>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="neutral" variant="outline">
              <Icon.Image size={10} /> {plots.length} image page{plots.length === 1 ? '' : 's'}
            </Chip>
            <Chip tone="travel" variant="outline">
              Source: {imp.sourceLanguage.toUpperCase()}
            </Chip>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {plots.map(({ sectionKey, section, plot }, i) => (
          <PlotCard
            key={`${sectionKey}-${plot.page}-${i}`}
            sectionKey={sectionKey}
            section={section}
            plot={plot}
          />
        ))}
      </div>
    </div>
  );
}
