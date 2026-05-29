import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { SourceTag } from '@/components/provenance/SourceTag';
import { SectionPlotCard, PlotImageLightbox, collectPlotsBySection } from '@/routes/RiderIngest';

export function Plots() {
  const { tour } = useApp();
  const navigate = useNavigate();
  const imp = tour.riderImports[0];
  const sectionPlots = imp ? collectPlotsBySection(imp) : [];
  const totalPages = sectionPlots.reduce((n, sp) => n + sp.plots.length, 0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  if (!imp || sectionPlots.length === 0) {
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

  const active = lightboxIdx != null ? sectionPlots[lightboxIdx] : null;

  return (
    <div>
      <PageHeader
        eyebrow={`${sectionPlots.length} section${sectionPlots.length === 1 ? '' : 's'} · ${totalPages} image${totalPages === 1 ? '' : 's'} from ${imp.filename}`}
        title={
          <span className="inline-flex items-baseline gap-1">
            Plots
            <SourceTag source="rider_plots" field="Stage plot & lightplot" />
          </span>
        }
        description="One card per plot section. Click to flip through that section's pages as fullscreen images — no PDF scrolling, no other rider pages."
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
              <Icon.Image size={10} /> {totalPages} image{totalPages === 1 ? '' : 's'}
            </Chip>
            <Chip tone="travel" variant="outline">
              Source: {imp.sourceLanguage.toUpperCase()}
            </Chip>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {sectionPlots.map(({ sectionKey, section, plots }, i) => (
          <SectionPlotCard
            key={sectionKey}
            section={section}
            plots={plots}
            onOpen={() => setLightboxIdx(i)}
          />
        ))}
      </div>

      <PlotImageLightbox
        open={active != null}
        onClose={() => setLightboxIdx(null)}
        section={active?.section ?? null}
        plots={active?.plots ?? []}
      />
    </div>
  );
}
