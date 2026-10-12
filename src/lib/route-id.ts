// A numeric route segment as a safe integer, or null (callers then notFound()).
export function parseRouteId(raw: string) {
  const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
