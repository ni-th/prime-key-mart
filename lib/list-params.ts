/**
 * Helpers for admin list pages whose search/filter/sort/page state lives in the
 * URL (so views can be bookmarked, shared and navigated with Back).
 */
export type RawParams = Record<string, string | string[] | undefined>;

/** First value of a search param, trimmed; "" when missing. */
export function param(sp: RawParams, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

/** Value only if it's one of `allowed`, else `fallback`. */
export function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** 1-based page number from `?page=`, clamped to >= 1. */
export function pageParam(sp: RawParams): number {
  const n = Number.parseInt(param(sp, "page"), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Build a link to `path` that keeps the current params but applies `changes`
 * (null/"" deletes a param). Changing any filter resets to page 1 unless the
 * change is the page itself.
 */
export function hrefWith(
  path: string,
  current: RawParams,
  changes: Record<string, string | number | null | undefined>,
): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value) next.set(k, value);
  }
  if (!("page" in changes)) next.delete("page");
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === undefined || v === "") next.delete(k);
    else next.set(k, String(v));
  }
  const qs = next.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Clamp a requested page into 1..last (an out-of-range ?page= shows the last page). */
export function clampPage(requestedPage: number, total: number, pageSize: number): number {
  const last = Math.max(1, Math.ceil(total / pageSize));
  return Math.min(Math.max(1, requestedPage), last);
}

/** Clamp the page and slice an in-memory list. */
export function paginate<T>(rows: T[], requestedPage: number, pageSize: number) {
  const page = clampPage(requestedPage, rows.length, pageSize);
  return {
    page,
    items: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
  };
}

/** Parse a yyyy-mm-dd date from a date input; null if invalid. */
export function dateParam(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
