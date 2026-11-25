"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin";
import { encryptSecret, keyFingerprint } from "@/lib/crypto";
import { sendOrderKeysEmail, sendPaymentReportClosedEmail } from "@/lib/mailer";
import { fulfillOrder, releaseOrderReservation } from "@/lib/inventory";
import {
  KEY_BATCH_MAX_LINES,
  emailField,
  idField,
  licenseKeyBatchSchema,
  productSchema,
  slugify,
} from "@/lib/validation";
import { queueStockCheck } from "@/lib/alerts";
import { asDeliveryType, encodeAccount, parseAccountLine } from "@/lib/delivery";

/** A form field that must be a database id (or an order number); null if it isn't. */
function formId(formData: FormData, key: string): string | null {
  const parsed = idField.safeParse(formData.get(key));
  return parsed.success ? parsed.data : null;
}

/** A text field from a form, trimmed. Anything that isn't text (e.g. a file) counts as empty. */
function formText(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** A short free-text note from a form (refund reason, suspension note...). */
function formNote(formData: FormData, key = "note"): string {
  return formText(formData, key).slice(0, 1000);
}

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
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/products/${slug}`);
}

// --- Products ---------------------------------------------------------------

export async function saveProduct(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const id = formId(formData, "id");
  const name = formText(formData, "name");
  const rawSlug = formText(formData, "slug");
  const priceInput = parseFloat(formText(formData, "price"));
  // Empty = no fixed LKR price (calculated from USD). Whole rupees only.
  const lkrRaw = formText(formData, "priceLkr");
  const lkrInput = lkrRaw === "" ? null : parseFloat(lkrRaw);
  // Empty = use the store-wide low stock level.
  const thresholdRaw = formText(formData, "lowStockThreshold");
  // Empty = cost not tracked for this product.
  const costRaw = formText(formData, "cost");
  const costInput = costRaw === "" ? null : parseFloat(costRaw);

  const candidate = {
    name,
    slug: rawSlug ? slugify(rawSlug) : slugify(name),
    shortDescription: formText(formData, "shortDescription"),
    description: formText(formData, "description"),
    brand: formText(formData, "brand"),
    platform: formText(formData, "platform"),
    region: formText(formData, "region") || "Global",
    priceCents: Number.isFinite(priceInput) ? Math.round(priceInput * 100) : NaN,
    priceLkrCents:
      lkrInput === null ? null : Number.isFinite(lkrInput) ? Math.round(lkrInput) * 100 : NaN,
    costCents:
      costInput === null ? null : Number.isFinite(costInput) ? Math.round(costInput * 100) : NaN,
    costCurrency: formData.get("costCurrency") === "LKR" ? "LKR" : "USD",
    lowStockThreshold: thresholdRaw === "" ? null : Number(thresholdRaw),
    categoryId: formText(formData, "categoryId"),
    deliveryType: asDeliveryType(formData.get("deliveryType")),
    activationSteps: formText(formData, "activationSteps"),
    imageUrl: formText(formData, "imageUrl"),
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
    priceLkrCents: data.priceLkrCents,
    costCents: data.costCents,
    costCurrency: data.costCurrency,
    lowStockThreshold: data.lowStockThreshold,
    categoryId: data.categoryId,
    deliveryType: data.deliveryType,
    activationSteps: data.activationSteps || null,
    imageUrl: data.imageUrl ? data.imageUrl : null,
    published: data.published,
    featured: data.featured,
  };

  // Warranty: store plans, or a custom selection with optional percentages.
  const rawMode = formData.get("warrantyMode");
  const warrantyMode = rawMode === "CUSTOM" || rawMode === "STORE" ? rawMode : "NONE";
  const overrides: { planId: string; percent: number | null }[] = [];
  if (warrantyMode === "CUSTOM") {
    const plans = await prisma.warrantyPlan.findMany({ select: { id: true } });
    for (const plan of plans) {
      if (formData.get(`warranty_${plan.id}`) !== "on") continue;
      const raw = String(formData.get(`warrantyPct_${plan.id}`) ?? "").trim();
      const pct = raw === "" ? null : Number.parseFloat(raw);
      if (pct !== null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
        return { ok: false, error: "Warranty percentages must be between 0 and 100." };
      }
      overrides.push({ planId: plan.id, percent: pct === null ? null : Math.round(pct * 10) / 10 });
    }
  }

  const productId = id
    ? (await prisma.product.update({ where: { id }, data: { ...values, warrantyMode } })).id
    : (await prisma.product.create({ data: { ...values, warrantyMode } })).id;
  await prisma.$transaction([
    prisma.productWarranty.deleteMany({ where: { productId } }),
    prisma.productWarranty.createMany({ data: overrides.map((o) => ({ ...o, productId })) }),
  ]);
  // The alert level may have changed (or the product was just published).
  if (id) queueStockCheck([id]);

  revalidateCatalog(data.slug);
  redirect("/admin/products");
}

export async function deleteProduct(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const id = formId(formData, "id");
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

  const batch = licenseKeyBatchSchema.safeParse({
    productId: formData.get("productId"),
    raw: formData.get("raw") ?? "",
  });
  if (!batch.success) {
    const issue = batch.error.issues[0];
    return { ok: false, error: issue?.path[0] === "productId" ? "Missing product." : (issue?.message ?? "Paste at least one key.") };
  }
  const { productId, raw } = batch.data;

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
  if (lines.length > KEY_BATCH_MAX_LINES) {
    return {
      ok: false,
      error: `That's ${lines.length} lines: add at most ${KEY_BATCH_MAX_LINES} per batch. Nothing was added.`,
    };
  }
  const tooLong = lines.findIndex((l) => l.length > 500);
  if (tooLong !== -1) {
    return { ok: false, error: `Line ${tooLong + 1} is too long to be a key (500 characters max). Nothing was added.` };
  }

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { deliveryType: true } });
  if (!product) return { ok: false, error: "Missing product." };

  // Accounts: "username, password" per line, stored as one encrypted secret.
  // Duplicates are matched on the username.
  let entries: { plain: string; fingerprint: string }[];
  if (product.deliveryType === "ACCOUNT") {
    const bad: number[] = [];
    entries = [];
    lines.forEach((line, i) => {
      const acc = parseAccountLine(line);
      if (!acc) bad.push(i + 1);
      else
        entries.push({
          plain: encodeAccount(acc.username, acc.password),
          fingerprint: keyFingerprint(`ACCOUNT:${acc.username}`),
        });
    });
    if (bad.length > 0) {
      return {
        ok: false,
        error: `Line${bad.length === 1 ? "" : "s"} ${bad.slice(0, 5).join(", ")}${bad.length > 5 ? "..." : ""}: use "username, password". Nothing was added.`,
      };
    }
    entries = [...new Map(entries.map((e) => [e.fingerprint, e])).values()];
  } else {
    entries = lines.map((plain) => ({ plain, fingerprint: keyFingerprint(plain) }));
  }

  const fingerprints = entries.map((e) => e.fingerprint);
  const existing = await prisma.licenseKey.findMany({
    where: { fingerprint: { in: fingerprints } },
    select: { fingerprint: true },
  });
  const existingSet = new Set(existing.map((e) => e.fingerprint));

  const toInsert = entries
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
    // Restocked: re-arms the low/out of stock alert.
    queueStockCheck([productId]);
  }

  revalidatePath(`/admin/products/${productId}/keys`);
  revalidateCatalog();

  const skipped = lines.length - toInsert.length;
  const noun = product.deliveryType === "ACCOUNT" ? "account" : "key";
  return {
    ok: true,
    message: `Added ${toInsert.length} ${noun}${toInsert.length === 1 ? "" : "s"}${
      skipped ? `, skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}` : ""
    }.`,
  };
}

export async function deleteLicenseKey(formData: FormData): Promise<void> {
  const admin = await getAdminSession();
  if (!admin) return;

  const id = formId(formData, "id");
  if (!id) return;
  const key = await prisma.licenseKey.findUnique({ where: { id } });
  if (!key || key.status === "SOLD") return;

  await prisma.licenseKey.delete({ where: { id } });
  queueStockCheck([key.productId]);
  revalidatePath(`/admin/products/${key.productId}/keys`);
  revalidateCatalog();
}

// --- Orders --------------------------------------------------------------------

export async function resendOrderEmail(formData: FormData): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const orderNumber = formId(formData, "orderNumber");
  if (!orderNumber) return { ok: false, error: "Order not found." };
  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "FULFILLED") {
    return { ok: false, error: "Only delivered orders have keys to send." };
  }

  try {
    await sendOrderKeysEmail(orderNumber);
  } catch {
    return { ok: false, error: "Sending failed - check the mail settings." };
  }
  return { ok: true, message: `Keys email re-sent to ${order.email}.` };
}

export async function updateOrderStatus(
  formData: FormData,
): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const orderNumber = formId(formData, "orderNumber");
  const action = String(formData.get("action") ?? "");
  if (!orderNumber) return { ok: false, error: "Order not found." };
  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order) return { ok: false, error: "Order not found." };

  if (action === "refund") {
    if (order.status !== "FULFILLED" && order.status !== "PAID") {
      return { ok: false, error: "Only paid or delivered orders can be marked refunded." };
    }
    const note = formNote(formData);
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "REFUNDED",
          refundedAt: new Date(),
          refundNote: note || null,
        },
      });
      // A "paid, not delivered" order may hold some keys it never received:
      // put those back in stock. Delivered (SOLD) keys stay sold - the
      // customer has already seen them.
      const items = await tx.orderItem.findMany({ where: { orderId: order.id }, select: { id: true } });
      await tx.licenseKey.updateMany({
        where: { orderItemId: { in: items.map((i) => i.id) }, status: "RESERVED" },
        data: { status: "AVAILABLE", orderItemId: null, reservedAt: null },
      });
    });
    queueStockCheck(await prisma.orderItem
      .findMany({ where: { orderId: order.id }, select: { productId: true } })
      .then((rows) => rows.map((r) => r.productId)));
  } else if (action === "cancel") {
    if (order.status !== "PENDING") {
      return { ok: false, error: "Only pending orders can be cancelled." };
    }
    await releaseOrderReservation(order.id, "EXPIRED");
  } else if (action === "fulfill") {
    // EXPIRED too: the payment can succeed after the checkout timed out (the
    // confirmation from PayHere never reached us); fulfillOrder reserves fresh
    // keys. Never FAILED: no payment was made (checkout broke first, or
    // PayHere reported it failed/cancelled).
    if (order.status === "FAILED") {
      return {
        ok: false,
        error: "This order failed, so no payment was made. If PayHere does confirm a payment later, it's delivered automatically.",
      };
    }
    if (!["PENDING", "PAID", "EXPIRED"].includes(order.status)) {
      return { ok: false, error: "This order can't be delivered manually." };
    }
    const result = await fulfillOrder(order.id);
    if (result.status === "PAID") {
      revalidatePath(`/admin/orders/${orderNumber}`);
      return {
        ok: false,
        error: `Not enough stock to deliver: ${result.missing.join(", ")}. Add keys, then try again.`,
      };
    }
  } else if (action === "dismiss-report") {
    if (!order.issueReportedAt || order.issueResolvedAt) {
      return { ok: false, error: "There is no open report on this order." };
    }
    // The message goes to the customer (email + their order page).
    const message = formNote(formData);
    if (message.length < 10) {
      return { ok: false, error: "Write a short message to the customer explaining what you found." };
    }
    await prisma.order.update({
      where: { id: order.id },
      data: { issueResolvedAt: new Date(), issueResolution: message },
    });
    try {
      await sendPaymentReportClosedEmail(order.email, order.orderNumber, message);
    } catch (err) {
      console.error(`[admin] report-closed email failed for ${orderNumber}`, err);
      revalidatePath(`/admin/orders/${orderNumber}`);
      return {
        ok: false,
        error: `Report closed, but the email to ${order.email} failed. Contact them another way.`,
      };
    }
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

  const userId = formId(formData, "userId");
  if (!userId) return { ok: false, error: "User not found." };
  const suspend = formData.get("suspend") === "true";
  const note = formNote(formData);

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

  const userId = formId(formData, "userId");
  if (!userId) return { ok: false, error: "User not found." };
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

  const parsedEmail = emailField.safeParse(formData.get("email"));
  if (!parsedEmail.success) return { ok: false, error: "Enter a valid email address." };
  const email = parsedEmail.data;
  const block = formData.get("block") === "true";
  const note = formNote(formData);

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
