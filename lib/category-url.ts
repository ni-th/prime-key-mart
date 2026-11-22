/** Public address of a category page. Safe to import anywhere. */
export function categoryPath(slug: string): string {
  return `/category/${encodeURIComponent(slug)}`;
}
