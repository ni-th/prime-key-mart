/**
 * Keysby brand constants. The logo mark is a white key on an indigo-to-violet
 * rounded tile, drawn on a 64x64 grid so it stays crisp from 16px favicons up
 * to the 1200x630 share image. app/icon.svg is a static copy of LOGO_MARK_SVG.
 */
export const BRAND = {
  name: "Keysby",
  tagline: "Genuine software keys, delivered instantly",
  description:
    "Buy genuine Windows, Office and antivirus license keys at a fair price. Instant digital delivery to your inbox.",
  /** Gradient stops for the logo tile (indigo-500 -> violet-600). */
  from: "#6366F1",
  to: "#7C3AED",
  /** Dark backdrop used on the share image. */
  ink: "#0B0B14",
} as const;

/** Key glyph paths on the 64x64 grid, shared by every rendering of the mark. */
export const KEY_GLYPH = {
  bow: { cx: 24, cy: 24, r: 9 },
  shaft: "M30.4 30.4 L46 46",
  teeth: "M38.5 38.5 L43 34 M45.5 45.5 L50 41",
  stroke: 6,
} as const;

/** Standalone SVG of the mark (used for the favicon, apple icon and share image). */
export const LOGO_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${BRAND.from}"/>
      <stop offset="1" stop-color="${BRAND.to}"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#g)"/>
  <g fill="none" stroke="#fff" stroke-width="${KEY_GLYPH.stroke}" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="${KEY_GLYPH.bow.cx}" cy="${KEY_GLYPH.bow.cy}" r="${KEY_GLYPH.bow.r}"/>
    <path d="${KEY_GLYPH.shaft} ${KEY_GLYPH.teeth}"/>
  </g>
</svg>`;

/** data: URI of the mark, for <img> inside next/og ImageResponse. */
export const LOGO_MARK_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(LOGO_MARK_SVG).toString("base64")}`;
