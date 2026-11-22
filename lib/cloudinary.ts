import crypto from "node:crypto";

/**
 * Cloudinary product-image uploads (server side). The browser uploads the file
 * straight to Cloudinary using a short-lived signature from us, so the API
 * secret never leaves the server and files don't pass through our functions.
 * No SDK needed: a signature is a SHA-1 of the sorted params + the secret.
 *
 * Env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
 */
const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? "";
const apiKey = process.env.CLOUDINARY_API_KEY?.trim() ?? "";
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() ?? "";

export const isCloudinaryConfigured = Boolean(cloudName && apiKey && apiSecret);

/** Where product images are stored in the Cloudinary media library. */
export const PRODUCT_IMAGE_FOLDER = "keysby/products";
/** Formats Cloudinary will accept for product images (enforced by Cloudinary). */
export const ALLOWED_IMAGE_FORMATS = "jpg,jpeg,png,webp";

export type UploadSignature = {
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  allowedFormats: string;
};

/** Sign an upload. Valid for about an hour (Cloudinary checks the timestamp). */
export function signProductImageUpload(folder: string = PRODUCT_IMAGE_FOLDER): UploadSignature {
  if (!isCloudinaryConfigured) throw new Error("Cloudinary is not configured");

  const timestamp = Math.floor(Date.now() / 1000);
  // Every param sent with the upload (except file, api_key, signature) must be
  // signed, in alphabetical order.
  const params: Record<string, string | number> = {
    allowed_formats: ALLOWED_IMAGE_FORMATS,
    folder,
    timestamp,
  };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const signature = crypto
    .createHash("sha1")
    .update(toSign + apiSecret)
    .digest("hex");

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    apiKey,
    timestamp,
    signature,
    folder,
    allowedFormats: ALLOWED_IMAGE_FORMATS,
  };
}
