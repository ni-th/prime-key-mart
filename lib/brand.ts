/**
 * Keysby brand constants.
 *
 * Logo artwork lives in public/images (keysby-2.png = full logo,
 * keysby.png = K mark). Cleaned/derived versions used by the site:
 *   public/images/brand/keysby-logo-dark.png   full logo, white parts (dark UI)
 *   public/images/brand/keysby-logo-light.png  full logo, ink parts (light UI)
 *   public/images/brand/keysby-mark.png        K mark only
 *   app/icon.png, app/apple-icon.png           mark on a dark tile (favicon/iOS)
 */
export const BRAND = {
  name: "Keysby",
  tagline: "Genuine software keys, delivered instantly",
  description:
    "Buy genuine Windows, Office and antivirus license keys at a fair price. Instant digital delivery to your inbox.",
  /** Gradient colors sampled from the logo (blue -> violet). */
  from: "#4F6BFF",
  to: "#7C3AED",
  /** Dark backdrop used behind the icon and on the share image. */
  ink: "#0B0B14",
} as const;
