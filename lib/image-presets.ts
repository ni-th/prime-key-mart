/**
 * Upload presets: crop shape, export size and Cloudinary folder for each kind
 * of image. Shared by the admin uploader (client) and the upload signer
 * (server), so it must stay free of server-only imports.
 */
export const IMAGE_PRESETS = {
  product: {
    folder: "keysby/products",
    aspect: 16 / 10,
    aspectLabel: "16:10",
    outputWidth: 1600,
    minSharpWidth: 1200,
    previewClass: "aspect-16/10 w-48",
    cropHint:
      "Products are shown at 16:10; keep the product near the middle (the cart shows a square from the center).",
  },
  banner: {
    folder: "keysby/banners",
    aspect: 4 / 1,
    aspectLabel: "4:1",
    outputWidth: 1920,
    minSharpWidth: 1400,
    previewClass: "aspect-4/1 w-full max-w-md",
    cropHint:
      "Shown full width on computers and tablets. Keep text and logos away from the edges.",
  },
  bannerMobile: {
    folder: "keysby/banners",
    aspect: 2 / 1,
    aspectLabel: "2:1",
    outputWidth: 1200,
    minSharpWidth: 800,
    previewClass: "aspect-2/1 w-64",
    cropHint: "Shown on phones. Use larger text than on the desktop banner.",
  },
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

export function isImagePreset(v: unknown): v is ImagePreset {
  return typeof v === "string" && v in IMAGE_PRESETS;
}
