"use server";

import { getAdminSession } from "@/lib/admin";
import {
  isCloudinaryConfigured,
  signProductImageUpload,
  type UploadSignature,
} from "@/lib/cloudinary";
import { IMAGE_PRESETS, isImagePreset, type ImagePreset } from "@/lib/image-presets";

export type SignatureResult =
  | { ok: true; signature: UploadSignature }
  | { ok: false; error: string };

/**
 * Signature for one image upload (product image or category banner; the
 * preset decides the Cloudinary folder). Admins only (and, via
 * getAdminSession, only after passing 2FA), so nobody else can use our
 * Cloudinary account to host files.
 */
export async function getProductImageUploadSignature(
  preset: ImagePreset = "product",
): Promise<SignatureResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };
  if (!isCloudinaryConfigured) {
    return { ok: false, error: "Image uploads aren't set up (Cloudinary keys missing)." };
  }
  if (!isImagePreset(preset)) return { ok: false, error: "Unknown image type." };
  return { ok: true, signature: signProductImageUpload(IMAGE_PRESETS[preset].folder) };
}
