// Helpers for list pages driven by URL search params (no client state).
export type SearchParams = Record<string, string | string[] | undefined>;

export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

// Positive integer from a param, or the fallback.
export function intParam(value: string | string[] | undefined, fallback = 1) {
  const n = Number.parseInt(firstParam(value) ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Only keys in `allowed` are accepted, so the value is safe to map to a column.
export function sortParams<K extends string>(
  params: SearchParams,
  allowed: readonly K[],
  fallback: { sort: K; order: "asc" | "desc" },
) {
  const sort = firstParam(params.sort);
  const order = firstParam(params.order);
  return {
    sort: allowed.find((key) => key === sort) ?? fallback.sort,
    order: order === "asc" || order === "desc" ? order : fallback.order,
  };
}
