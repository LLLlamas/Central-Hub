// Shared lat/lng → SVG coordinate projection math, extracted out of
// RouteMap.tsx so other map surfaces (e.g. the My Tours map) can reuse it
// without duplicating the projection logic. Linear projection is fine at
// this resolution — these are illustrative routing maps, not navigation
// charts.

export interface CityCoord {
  lat: number;
  lng: number;
}

// Approximate lat/lng for each show city on the tour.
export const CITY_COORDS: Record<string, CityCoord> = {
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

export interface MapPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Matches the padding RouteMap has always used around its plot area.
export const DEFAULT_MAP_PADDING: MapPadding = { top: 28, right: 28, bottom: 28, left: 28 };

export interface ProjectionBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// Computes the lat/lng bounding box for a set of coords, used to normalize
// the projection. Guards against a single point (or all-identical points)
// collapsing the range to zero.
export function computeBounds(coords: CityCoord[]): ProjectionBounds {
  const lats = coords.map((c) => c.lat);
  const lngs = coords.map((c) => c.lng);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

// Expands degenerate or near-degenerate bounds symmetrically around their
// center so a single city (or a tight cluster) projects to the middle of the
// plot instead of collapsing into the top-left padding corner — project()'s
// zero-range guard alone would pin such a point at (pad.left, pad.top).
// The lng floor is 1.5x the lat floor to match the 540x360 (3:2) viewBox, so
// a lone pin sits dead-center with even margins. Pass the result of
// computeBounds() through here before calling project().
export function padBounds(bounds: ProjectionBounds, minSpan = 4): ProjectionBounds {
  const latCenter = (bounds.minLat + bounds.maxLat) / 2;
  const lngCenter = (bounds.minLng + bounds.maxLng) / 2;
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, minSpan);
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, minSpan * 1.5);
  return {
    minLat: latCenter - latSpan / 2,
    maxLat: latCenter + latSpan / 2,
    minLng: lngCenter - lngSpan / 2,
    maxLng: lngCenter + lngSpan / 2,
  };
}

// Projects a lat/lng pair into SVG x/y coordinates within a `width` x
// `height` viewBox, given the bounding box of all points being plotted.
export function project(
  lat: number,
  lng: number,
  bounds: ProjectionBounds,
  width: number,
  height: number,
  padding: MapPadding = DEFAULT_MAP_PADDING,
): { x: number; y: number } {
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const latRange = Math.max(0.0001, bounds.maxLat - bounds.minLat);
  const lngRange = Math.max(0.0001, bounds.maxLng - bounds.minLng);
  return {
    x: padding.left + ((lng - bounds.minLng) / lngRange) * innerW,
    y: padding.top + ((bounds.maxLat - lat) / latRange) * innerH,
  };
}
