"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin";
import { encryptSecret, keyFingerprint } from "@/lib/crypto";
import { sendOrderKeysEmail } from "@/lib/mailer";
import { releaseOrderReservation } from "@/lib/inventory";
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
    const note = ((formData.get("note") as string) ?? "").trim().slice(0, 1000);
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "REFUNDED",
        refundedAt: new Date(),
        refundNote: note || null,
      },
    });
  } else if (action === "cancel") {
    if (order.status !== "PENDING") {
      return { ok: false, error: "Only pending orders can be cancelled." };
    }
    await releaseOrderReservation(order.id, "EXPIRED");
  } else {
    return { ok: false, error: "Unknown action." };
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderNumber}`);
  revalidatePath("/admin");
  return { ok: true, message: "Order updated." };
}

// --- Users -------------------------------------------------------------------

function revalidateUsers(id?: string) {
  revalidatePath("/admin/users");
  if (id) revalidatePath(`/admin/users/${id}`);
}

export async function setUserSuspended(
  formData: FormData,
): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const userId = formData.get("userId") as string;
  const suspend = formData.get("suspend") === "true";
  const note = ((formData.get("note") as string) ?? "").trim().slice(0, 1000);

  if (userId === admin.user.id) {
    return { ok: false, error: "You can't suspend your own account." };
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "User not found." };

  await prisma.user.update({
    where: { id: userId },
    data: {
      suspended: suspend,
      suspendedAt: suspend ? new Date() : null,
      suspensionNote: suspend ? note || null : null,
    },
  });

  revalidateUsers(userId);
  return {
    ok: true,
    message: suspend ? "Account suspended." : "Account re-enabled.",
  };
}

export async function setUserRole(formData: FormData): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const userId = formData.get("userId") as string;
  const role = formData.get("role") === "ADMIN" ? "ADMIN" : "USER";

  if (userId === admin.user.id) {
    return { ok: false, error: "You can't change your own role." };
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "User not found." };

  if (user.role === "ADMIN" && role === "USER") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) {
      return { ok: false, error: "There must be at least one admin." };
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidateUsers(userId);
  return { ok: true, message: `Role set to ${role.toLowerCase()}.` };
}

export async function setEmailBlocked(formData: FormData): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const email = ((formData.get("email") as string) ?? "").trim().toLowerCase();
  const block = formData.get("block") === "true";
  const note = ((formData.get("note") as string) ?? "").trim().slice(0, 1000);
  if (!email) return { ok: false, error: "Missing email." };

  if (email === admin.user.email?.toLowerCase()) {
    return { ok: false, error: "You can't block your own email." };
  }

  if (block) {
    await prisma.blockedEmail.upsert({
      where: { email },
      update: { note: note || null },
      create: { email, note: note || null },
    });
  } else {
    await prisma.blockedEmail.deleteMany({ where: { email } });
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/guest/${encodeURIComponent(email)}`);
  return { ok: true, message: block ? "Email blocked." : "Email unblocked." };
}
