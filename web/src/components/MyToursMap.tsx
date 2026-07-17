// Map for the "My Tours" home page — one pin per tour, plotted at its
// primaryCity. Visual language borrows from RouteMap.tsx (grid, compass,
// numbered-circle chrome) but this is a distinct component: RouteMap plots a
// single tour's leg-by-leg route, this plots the whole multi-tour roster and
// lives outside the /t/:tourId branch.

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ID, TourSummary } from '@/types';
import { CITY_COORDS, computeBounds, padBounds, project, type CityCoord } from '@/lib/mapProjection';
import { tourPath } from '@/lib/routing';
import { TOUR_STATUS_LABEL } from '@/lib/tourSummary';

const STATUS_COLOR: Record<TourSummary['status'], string> = {
  draft: 'var(--color-ink-3)',
  upcoming: 'var(--color-ocean)',
  on_tour: 'var(--color-day-show)',
  completed: 'var(--color-moss)',
};

interface CityGroup {
  city: string;
  coord: CityCoord;
  tours: TourSummary[];
}

export function MyToursMap({
  tours,
  onSelectTour,
}: {
  tours: TourSummary[];
  onSelectTour?: (tourId: ID) => void;
}) {
  const navigate = useNavigate();

  // Group tours by primaryCity so multiple tours based in the same city share
  // one pin location (stacked/offset below) instead of perfectly overlapping.
  // Tours whose primaryCity isn't in CITY_COORDS are skipped, not crashed on
  // — a known pre-existing gap in city coverage.
  const groups = useMemo(() => {
    const byCity = new Map<string, CityGroup>();
    for (const t of tours) {
      if (!t.primaryCity) continue;
      const coord = CITY_COORDS[t.primaryCity];
      if (!coord) continue;
      const existing = byCity.get(t.primaryCity);
      if (existing) existing.tours.push(t);
      else byCity.set(t.primaryCity, { city: t.primaryCity, coord, tours: [t] });
    }
    return Array.from(byCity.values());
  }, [tours]);

  const handleSelect = (tourId: ID) => {
    if (onSelectTour) onSelectTour(tourId);
    else navigate(tourPath(tourId));
  };

  if (groups.length === 0) {
    return (
      <section className="card p-6">
        <div className="eyebrow">Tour map</div>
        <p className="mt-2 text-[12.5px] text-[var(--color-ink-3)]">
          No tours to plot yet — the map fills in once a tour has a city.
        </p>
      </section>
    );
  }

  const W = 540;
  const H = 360;
  const pad = { top: 28, right: 28, bottom: 28, left: 28 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  // padBounds keeps a single city (or tight cluster) centered instead of
  // letting a degenerate lat/lng range collapse the pin into the top-left.
  const bounds = padBounds(computeBounds(groups.map((g) => g.coord)));
  const { minLat, maxLat, minLng } = bounds;
  const projectPoint = (lat: number, lng: number) => project(lat, lng, bounds, W, H, pad);

  // Only tours with a plottable city appear on the map — count those, not
  // the whole roster the caller passed in.
  const plottedCount = groups.reduce((n, g) => n + g.tours.length, 0);

  // Pin labels are centered on the pin; near the viewBox edges that would
  // clip the text, so clamp the label's x so its estimated width stays inside.
  const clampLabelX = (x: number, text: string) => {
    const halfW = (text.length * 5.8) / 2 + 2; // ~9.5px mono ≈ 5.8px/char
    return Math.min(Math.max(x, halfW), W - halfW);
  };

  return (
    <section className="card overflow-hidden">
      <header className="flex items-baseline justify-between border-b border-[var(--color-rule-soft)] px-6 pt-5 pb-3">
        <div>
          <div className="eyebrow mb-1">Tour map</div>
          <h3 className="font-display text-[18px] font-bold tracking-tight text-[var(--color-ink)]">
            {groups.length} {groups.length === 1 ? 'city' : 'cities'} · {plottedCount}{' '}
            {plottedCount === 1 ? 'tour' : 'tours'}
          </h3>
        </div>
      </header>

      {/* Cap the plot's width so the 540x360 viewBox reads as a compact atlas
          panel instead of scaling edge-to-edge on wide screens. */}
      <div className="px-4 py-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full h-auto max-w-[720px] mx-auto"
          aria-label="Tour map — one pin per tour"
        >
          <defs>
            <pattern id="my-tours-grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="var(--color-rule-soft)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect x={pad.left} y={pad.top} width={innerW} height={innerH} fill="url(#my-tours-grid)" />

          {/* Compass / "N" arrow in corner */}
          <g transform={`translate(${W - pad.right - 14},${pad.top + 12})`}>
            <line x1="0" y1="-8" x2="0" y2="8" stroke="var(--color-ink-3)" strokeWidth="0.8" />
            <path d="M-3,-5 L0,-9 L3,-5" fill="none" stroke="var(--color-ink-3)" strokeWidth="0.8" />
            <text x="6" y="-3" fontSize="9" fontFamily="JetBrains Mono" fill="var(--color-ink-3)">
              N
            </text>
          </g>

          {/* Equator reference if visible */}
          {minLat < 0 && maxLat > 0 && (
            <line
              x1={pad.left}
              y1={projectPoint(0, minLng).y}
              x2={pad.left + innerW}
              y2={projectPoint(0, minLng).y}
              stroke="var(--color-rule)"
              strokeWidth="0.6"
              strokeDasharray="2 3"
            />
          )}

          {/* One pin per tour, grouped/offset by shared city */}
          {groups.map((g) => {
            const center = projectPoint(g.coord.lat, g.coord.lng);
            return g.tours.map((t, i) => {
              const offset = g.tours.length > 1 ? (i - (g.tours.length - 1) / 2) * 14 : 0;
              const cx = center.x + offset;
              const cy = center.y;
              const color = STATUS_COLOR[t.status];
              const shortName = t.name.length > 16 ? `${t.name.slice(0, 15)}…` : t.name;
              return (
                <g
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${t.name}`}
                  onClick={() => handleSelect(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelect(t.id);
                    }
                  }}
                  className="cursor-pointer"
                >
                  <circle cx={cx} cy={cy} r="10" fill="var(--color-card)" stroke={color} strokeWidth="1.5" />
                  <circle cx={cx} cy={cy} r="3.5" fill={color} />
                  <text
                    x={clampLabelX(cx, shortName)}
                    y={cy + 21}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontFamily="JetBrains Mono"
                    fontWeight="600"
                    fill="var(--color-ink-2)"
                  >
                    {shortName}
                  </text>
                </g>
              );
            });
          })}
        </svg>
      </div>

      {/* Legend: cities → tours, with status dot */}
      <ol className="px-4 pb-4 space-y-1.5">
        {groups.map((g) => (
          <li key={g.city} className="text-[11.5px] leading-tight">
            <span className="font-semibold text-[var(--color-ink)]">{g.city}</span>
            <span className="text-[var(--color-ink-4)]"> · </span>
            {g.tours.map((t, i) => (
              <span key={t.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(t.id)}
                  className="inline-flex items-center gap-1 cursor-pointer text-[var(--color-ink-2)] underline decoration-dotted hover:text-[var(--color-ink)] transition-colors"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: STATUS_COLOR[t.status] }}
                    aria-hidden="true"
                  />
                  {t.name}
                  <span className="text-[10px] text-[var(--color-ink-4)]">
                    ({TOUR_STATUS_LABEL[t.status]})
                  </span>
                </button>
                {i < g.tours.length - 1 && <span className="text-[var(--color-ink-4)]">, </span>}
              </span>
            ))}
          </li>
        ))}
      </ol>
    </section>
  );
}
