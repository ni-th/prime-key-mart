/** Public origin of the site, without a trailing slash (from SITE_URL). */
export function siteUrl(): string {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Absolute URL for a site path or an already-absolute URL (e.g. Cloudinary). */
export function absoluteUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, `${siteUrl()}/`).toString();
}

/**
 * JSON-LD as a string safe to put inside <script type="application/ld+json">:
 * `<` is escaped so text from the database can't close the script tag.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
