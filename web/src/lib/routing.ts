// Single source of truth for building `/t/:tourId/...` paths. Every surface
// under the `/t/:tourId` nested route needs to link to a sibling route with
// the same tourId — this is the one place that does the string concatenation
// instead of every call site hand-rolling `` `/t/${tourId}/${path}` ``.
//
// `path` may be given with or without a leading slash; pass '' (or omit it)
// for the tour root itself (e.g. a "back to this tour" link).
export function tourPath(tourId: string, path: string = ''): string {
  const clean = path.replace(/^\/+/, '');
  return clean ? `/t/${tourId}/${clean}` : `/t/${tourId}`;
}
