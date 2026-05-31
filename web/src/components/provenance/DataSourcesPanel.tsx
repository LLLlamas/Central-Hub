import type { SourceKey } from '@/data/sources';

interface DataSourcesPanelProps {
  /** Source keys (entity types) relevant to this page. */
  sourceKeys: SourceKey[];
  /** Optional intro override. */
  intro?: string;
}

/**
 * Per-page "where this data comes from" panel — REMOVED app-wide (see CLAUDE.md
 * "Provenance"). Renders nothing so its call sites stay valid; the blue
 * `SourceTag` real-source citations are kept. Reversible via git history.
 */
export function DataSourcesPanel(_props: DataSourcesPanelProps) {
  return null;
}
