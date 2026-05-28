import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { MockTag } from '@/components/provenance/MockTag';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/cn';

interface CityCoord {
  lat: number;
  lng: number;
}

// Approximate lat/lng for each show city on the tour. Linear projection is
// fine at this resolution — this is an illustrative routing map, not a
// navigation chart.
const CITY_COORDS: Record<string, CityCoord> = {
  'Mexico City': { lat: 19.43, lng: -99.13 },
  Monterrey: { lat: 25.67, lng: -100.31 },
  Guadalajara: { lat: 20.67, lng: -103.35 },
  'Los Angeles': { lat: 34.05, lng: -118.24 },
  Oakland: { lat: 37.8, lng: -122.27 },
  Miami: { lat: 25.76, lng: -80.19 },
  'Bogotá': { lat: 4.71, lng: -74.07 },
  Lima: { lat: -12.05, lng: -77.04 },
  Santiago: { lat: -33.45, lng: -70.67 },
  'Buenos Aires': { lat: -34.61, lng: -58.38 },
};

const LEG_COLOR: Record<string, string> = {
  leg_mx: 'var(--color-day-show)',
  leg_us: 'var(--color-ocean)',
  leg_sa: 'var(--color-moss)',
};

const LEG_LABEL_COLOR: Record<string, string> = {
  leg_mx: '#b8392b',
  leg_us: '#3c5a6a',
  leg_sa: '#5a6638',
};

export function RouteMap({ embedded = false }: { embedded?: boolean } = {}) {
  const { tour } = useApp();

  // Build numbered stops in date order, deduped by city. The first time we
  // see a city we assign it the next stop number; subsequent visits append
  // to the same stop's dates list.
  const stops = useMemo(() => {
    const byCity = new Map<
      string,
      {
        n: number;
        city: string;
        country?: string;
        coord: CityCoord;
        legId: string;
        firstDate: string;
        lastDate: string;
        showCount: number;
      }
    >();
    for (const d of tour.days) {
      if (d.dayType !== 'show') continue;
      if (!d.city || !CITY_COORDS[d.city]) continue;
      const existing = byCity.get(d.city);
      if (existing) {
        existing.lastDate = d.date;
        existing.showCount += 1;
      } else {
        byCity.set(d.city, {
          n: byCity.size + 1,
          city: d.city,
          country: d.country,
          coord: CITY_COORDS[d.city],
          legId: d.legId ?? 'leg_mx',
          firstDate: d.date,
          lastDate: d.date,
          showCount: 1,
        });
      }
    }
    return Array.from(byCity.values());
  }, [tour.days]);

  if (stops.length === 0) {
    return (
      <section className={embedded ? '' : 'card p-6'}>
        {!embedded && <div className="eyebrow">Route map</div>}
        <p className={cn('text-[12.5px] text-[var(--color-ink-3)]', !embedded && 'mt-2')}>
          No show cities to plot yet.
        </p>
      </section>
    );
  }

  const W = 540;
  const H = 360;
  const pad = { top: 28, right: 28, bottom: 28, left: 28 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const lats = stops.map((s) => s.coord.lat);
  const lngs = stops.map((s) => s.coord.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(0.0001, maxLat - minLat);
  const lngRange = Math.max(0.0001, maxLng - minLng);

  const project = (lat: number, lng: number) => ({
    x: pad.left + ((lng - minLng) / lngRange) * innerW,
    y: pad.top + ((maxLat - lat) / latRange) * innerH,
  });

  return (
    <section className={embedded ? 'overflow-hidden' : 'card overflow-hidden'}>
      <header className={cn(
        'flex items-baseline justify-between border-b border-[var(--color-rule-soft)]',
        embedded ? 'pb-3' : 'px-6 pt-5 pb-3',
      )}>
        <div>
          <div className="eyebrow mb-1 inline-flex items-center gap-1">
            {embedded ? 'Stops' : 'Route map'}
            <MockTag source="tour_route" field="Tour route" />
          </div>
          <h3 className="font-display text-[18px] font-bold tracking-tight text-[var(--color-ink)]">
            {stops.length} cities · {tour.legs.length} legs
          </h3>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[11px]">
          {tour.legs.map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-1.5 text-[var(--color-ink-2)]"
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: LEG_COLOR[l.id] ?? 'var(--color-ink-3)' }}
              />
              {l.name}
            </span>
          ))}
        </div>
      </header>

      <div className="grid md:grid-cols-[1fr_220px]">
        {/* SVG plot */}
        <div className="px-4 py-4 border-r border-[var(--color-rule-soft)] md:border-r md:border-b-0 border-b">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto"
            aria-label="Tour route map"
          >
            <defs>
              <pattern id="route-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="var(--color-rule-soft)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect
              x={pad.left}
              y={pad.top}
              width={innerW}
              height={innerH}
              fill="url(#route-grid)"
            />

            {/* Compass / "N" arrow in corner */}
            <g transform={`translate(${W - pad.right - 14},${pad.top + 12})`}>
              <line x1="0" y1="-8" x2="0" y2="8" stroke="var(--color-ink-3)" strokeWidth="0.8" />
              <path d="M-3,-5 L0,-9 L3,-5" fill="none" stroke="var(--color-ink-3)" strokeWidth="0.8" />
              <text
                x="6"
                y="-3"
                fontSize="9"
                fontFamily="JetBrains Mono"
                fill="var(--color-ink-3)"
              >
                N
              </text>
            </g>

            {/* Equator reference if visible */}
            {minLat < 0 && maxLat > 0 && (
              <line
                x1={pad.left}
                y1={project(0, minLng).y}
                x2={pad.left + innerW}
                y2={project(0, minLng).y}
                stroke="var(--color-rule)"
                strokeWidth="0.6"
                strokeDasharray="2 3"
              />
            )}

            {/* Connecting lines between consecutive stops */}
            {stops.slice(0, -1).map((s, i) => {
              const next = stops[i + 1];
              const from = project(s.coord.lat, s.coord.lng);
              const to = project(next.coord.lat, next.coord.lng);
              const sameLeg = s.legId === next.legId;
              const color = LEG_COLOR[s.legId] ?? 'var(--color-ink-3)';
              return (
                <line
                  key={`l${i}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={color}
                  strokeWidth={sameLeg ? 1.6 : 1.2}
                  strokeDasharray={sameLeg ? undefined : '5 4'}
                  opacity={sameLeg ? 0.7 : 0.55}
                />
              );
            })}

            {/* Numbered city dots */}
            {stops.map((s) => {
              const p = project(s.coord.lat, s.coord.lng);
              const color = LEG_COLOR[s.legId] ?? 'var(--color-ink-3)';
              return (
                <g key={`d${s.n}`}>
                  <circle cx={p.x} cy={p.y} r="10" fill="var(--color-card)" stroke={color} strokeWidth="1.5" />
                  <text
                    x={p.x}
                    y={p.y + 3.5}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="JetBrains Mono"
                    fontWeight="700"
                    fill={color}
                  >
                    {s.n}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Numbered legend */}
        <ol className="py-2 px-2 md:max-h-[360px] overflow-y-auto">
          {stops.map((s) => (
            <li key={`leg-${s.n}`}>
              <Link
                to={`/daysheet/${s.firstDate}`}
                className="flex items-baseline gap-2.5 px-3 py-1.5 rounded-[3px] hover:bg-[var(--color-paper-2)] transition-colors"
              >
                <span
                  className={cn(
                    'inline-flex items-center justify-center shrink-0',
                    'w-5 h-5 rounded-full border text-[10px] font-mono font-bold tabular',
                  )}
                  style={{
                    color: LEG_LABEL_COLOR[s.legId] ?? 'var(--color-ink-2)',
                    borderColor: LEG_COLOR[s.legId] ?? 'var(--color-ink-3)',
                  }}
                >
                  {s.n}
                </span>
                <div className="flex-1 min-w-0 leading-tight">
                  <div className="text-[12.5px] font-semibold text-[var(--color-ink)] truncate">
                    {s.city}
                    {s.country && (
                      <span className="text-[var(--color-ink-4)] font-mono text-[10px] uppercase tracking-[0.10em] ml-1">
                        · {s.country}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[10.5px] tabular text-[var(--color-ink-3)]">
                    {fmtDate(s.firstDate, 'MMM d')}
                    {s.showCount > 1 && (
                      <span className="ml-1 text-[var(--color-ink-4)]">· {s.showCount} shows</span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
