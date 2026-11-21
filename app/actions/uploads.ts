"use server";

import { getAdminSession } from "@/lib/admin";
import {
  isCloudinaryConfigured,
  signProductImageUpload,
  type UploadSignature,
} from "@/lib/cloudinary";

export type SignatureResult =
  | { ok: true; signature: UploadSignature }
  | { ok: false; error: string };

/**
 * Signature for one product-image upload. Admins only (and, via
 * getAdminSession, only after passing 2FA), so nobody else can use our
 * Cloudinary account to host files.
 */
export async function getProductImageUploadSignature(): Promise<SignatureResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };
  if (!isCloudinaryConfigured) {
    return { ok: false, error: "Image uploads aren't set up (Cloudinary keys missing)." };
  }
  return { ok: true, signature: signProductImageUpload() };
}
