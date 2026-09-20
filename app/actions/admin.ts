"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin";
import { encryptSecret, keyFingerprint } from "@/lib/crypto";
import { sendOrderKeysEmail } from "@/lib/mailer";
import { fulfillOrder, releaseOrderReservation } from "@/lib/inventory";
import { productSchema, slugify } from "@/lib/validation";

export type FormResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrorsFrom(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}

function revalidateCatalog(slug?: string) {
  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/products");
  revalidatePath("/");
  if (slug) revalidatePath(`/products/${slug}`);
}

// --- Products ---------------------------------------------------------------

export async function saveProduct(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const id = (formData.get("id") as string) || null;
  const name = ((formData.get("name") as string) ?? "").trim();
  const rawSlug = ((formData.get("slug") as string) ?? "").trim();
  const priceInput = parseFloat((formData.get("price") as string) ?? "");

  const candidate = {
    name,
    slug: rawSlug ? slugify(rawSlug) : slugify(name),
    shortDescription: ((formData.get("shortDescription") as string) ?? "").trim(),
    description: ((formData.get("description") as string) ?? "").trim(),
    brand: ((formData.get("brand") as string) ?? "").trim(),
    platform: ((formData.get("platform") as string) ?? "").trim(),
    region: ((formData.get("region") as string) ?? "Global").trim() || "Global",
    priceCents: Number.isFinite(priceInput) ? Math.round(priceInput * 100) : NaN,
    categoryId: (formData.get("categoryId") as string) ?? "",
    imageUrl: ((formData.get("imageUrl") as string) ?? "").trim(),
    published: formData.get("published") === "on",
    featured: formData.get("featured") === "on",
  };

  const parsed = productSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }
  const data = parsed.data;

  const slugOwner = await prisma.product.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });
  if (slugOwner && slugOwner.id !== id) {
    return {
      ok: false,
      error: "That slug is already in use.",
      fieldErrors: { slug: "Already used by another product." },
    };
  }

  const values = {
    name: data.name,
    slug: data.slug,
    shortDescription: data.shortDescription,
    description: data.description,
    brand: data.brand,
    platform: data.platform,
    region: data.region,
    priceCents: data.priceCents,
    categoryId: data.categoryId,
    imageUrl: data.imageUrl ? data.imageUrl : null,
    published: data.published,
    featured: data.featured,
  };

  if (id) {
    await prisma.product.update({ where: { id }, data: values });
  } else {
    await prisma.product.create({ data: values });
  }

  revalidateCatalog(data.slug);
  redirect("/admin/products");
}

export async function deleteProduct(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const id = formData.get("id") as string;
  if (!id) return { ok: false, error: "Missing product id." };

  const orderedCount = await prisma.orderItem.count({ where: { productId: id } });
  if (orderedCount > 0) {
    return {
      ok: false,
      error:
        "This product appears in past orders and can't be deleted. Unpublish it instead.",
    };
  }

  await prisma.product.delete({ where: { id } });
  revalidateCatalog();
  redirect("/admin/products");
}

// --- License keys ----------------------------------------------------------

export async function addLicenseKeys(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const productId = formData.get("productId") as string;
  const raw = (formData.get("raw") as string) ?? "";
  if (!productId) return { ok: false, error: "Missing product." };

  const lines = Array.from(
    new Set(
      raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    ),
  );
  if (lines.length === 0) {
    return { ok: false, error: "Paste at least one key." };
  }

  const fingerprints = lines.map((l) => keyFingerprint(l));
  const existing = await prisma.licenseKey.findMany({
    where: { fingerprint: { in: fingerprints } },
    select: { fingerprint: true },
  });
  const existingSet = new Set(existing.map((e) => e.fingerprint));

  const toInsert = lines
    .map((plain) => ({ plain, fingerprint: keyFingerprint(plain) }))
    .filter((x) => !existingSet.has(x.fingerprint))
    .map((x) => {
      const enc = encryptSecret(x.plain);
      return {
        productId,
        fingerprint: x.fingerprint,
        secretCiphertext: enc.ciphertext,
        secretIv: enc.iv,
        secretAuthTag: enc.authTag,
      };
    });

  if (toInsert.length > 0) {
    await prisma.licenseKey.createMany({ data: toInsert, skipDuplicates: true });
  }

  revalidatePath(`/admin/products/${productId}/keys`);
  revalidateCatalog();

  const skipped = lines.length - toInsert.length;
  return {
    ok: true,
    message: `Added ${toInsert.length} key${toInsert.length === 1 ? "" : "s"}${
      skipped ? `, skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}` : ""
    }.`,
  };
}

export async function deleteLicenseKey(formData: FormData): Promise<void> {
  const admin = await getAdminSession();
  if (!admin) return;

  const id = formData.get("id") as string;
  const key = await prisma.licenseKey.findUnique({ where: { id } });
  if (!key || key.status === "SOLD") return;

  await prisma.licenseKey.delete({ where: { id } });
  revalidatePath(`/admin/products/${key.productId}/keys`);
  revalidateCatalog();
}

// --- Orders --------------------------------------------------------------------

export async function resendOrderEmail(formData: FormData): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const orderNumber = formData.get("orderNumber") as string;
  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "FULFILLED") {
    return { ok: false, error: "Only delivered orders have keys to send." };
  }

  try {
    await sendOrderKeysEmail(orderNumber);
  } catch {
    return { ok: false, error: "Sending failed — check the mail settings." };
  }
  return { ok: true, message: `Keys email re-sent to ${order.email}.` };
}

export async function updateOrderStatus(
  formData: FormData,
): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const orderNumber = formData.get("orderNumber") as string;
  const action = formData.get("action") as string;
  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order) return { ok: false, error: "Order not found." };

  if (action === "refund") {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "REFUNDED" },
    });
  } else if (action === "cancel") {
    if (order.status !== "PENDING") {
      return { ok: false, error: "Only pending orders can be cancelled." };
    }
    await releaseOrderReservation(order.id, "EXPIRED");
  } else if (action === "fulfill") {
    if (order.status !== "PENDING" && order.status !== "PAID") {
      return { ok: false, error: "Only pending or paid orders can be delivered manually." };
    }
    await fulfillOrder(order.id);
  } else {
    return { ok: false, error: "Unknown action." };
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderNumber}`);
  revalidatePath("/admin");
  return { ok: true, message: "Order updated." };
}
