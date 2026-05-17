import { useState } from 'react';
import { getSource, realSourceLabels, phaseLabels, type SourceKey } from '@/data/sources';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

interface DataSourcesPanelProps {
  /** Source keys (entity types) relevant to this page. */
  sourceKeys: SourceKey[];
  /** Optional intro override. */
  intro?: string;
}

/**
 * Per-page panel listing the data shown on the page and where each piece
 * would come from in production. Sits at the bottom of every page so
 * stakeholders can see the data lineage at a glance without polluting
 * the actual work surface.
 */
export function DataSourcesPanel({ sourceKeys, intro }: DataSourcesPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="card mt-10 border-dashed">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-3">
          <Chip tone="mock" variant="outline">
            Prototype
          </Chip>
          <div>
            <div className="text-[13px] font-semibold text-[var(--color-ink)] leading-tight">
              Where this data comes from
            </div>
            <div className="text-[11.5px] text-[var(--color-ink-3)] mt-0.5">
              {intro ??
                `Every entity on this page is mocked. Click to see the real-system source for each — pipeline phase, ingestion mechanism, and notes.`}
            </div>
          </div>
        </div>
        <Icon.ChevronDown
          className={cn('transition-transform text-[var(--color-ink-3)]', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="border-t border-dashed border-[var(--color-rule)] px-5 py-4 grid gap-3 sm:grid-cols-2">
          {sourceKeys.map((key) => {
            const prov = getSource(key);
            return (
              <div
                key={key}
                className="flex items-start gap-3 rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-paper)]/50 p-3"
              >
                <div className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-[#7a5a8a] mt-[3px] whitespace-nowrap">
                  {entityLabel(key)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold text-[var(--color-ink)] leading-tight">
                    {prov.source}
                  </div>
                  {prov.detail && (
                    <p className="mt-1 text-[11.5px] text-[var(--color-ink-3)] leading-relaxed">
                      {prov.detail}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Chip tone="neutral" size="sm">
                      {realSourceLabels[prov.realSource]}
                    </Chip>
                    <Chip tone="neutral" size="sm">
                      {phaseLabels[prov.phase]}
                    </Chip>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function entityLabel(key: SourceKey): string {
  return key.replaceAll('_', ' ');
}
