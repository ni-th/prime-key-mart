/**
 * Ask Cloudinary for a resized, auto-format (WebP/AVIF), auto-quality version
 * of an image by inserting a transformation into its delivery URL:
 *   .../image/upload/v123/keysby/products/x.png
 *   -> .../image/upload/f_auto,q_auto,c_limit,w_800/v123/keysby/products/x.png
 * Non-Cloudinary URLs are returned unchanged. Safe to use in the browser.
 */
export function optimizedImageUrl(url: string, width: number): string {
  const marker = "/image/upload/";
  if (!url.includes("res.cloudinary.com") || !url.includes(marker)) return url;
  const [base, rest] = url.split(marker);
  // Don't double-transform a URL that already has a transformation segment.
  if (/^[a-z]_[^/]+\//.test(rest)) return url;
  return `${base}${marker}f_auto,q_auto,c_limit,w_${Math.round(width)}/${rest}`;
}
