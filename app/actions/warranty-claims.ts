"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin";
import { canViewOrder, getOrderByNumber } from "@/lib/orders";
import { sendAlert } from "@/lib/alerts";
import { sendWarrantyClaimReceivedEmail } from "@/lib/mailer";
import { rateLimit } from "@/lib/rate-limit";
import { warrantySummary } from "@/lib/warranty";
import { checkStart, getFreeCheckHours, keyCover, resolveClaim } from "@/lib/warranty-claims";
import { CLAIM_REASONS, type ClaimReason } from "@/lib/warranty-claim-shared";

export type ClaimResult = { ok: true; message: string } | { ok: false; error: string };

const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const claimSchema = z.object({
  orderNumber: z.string().trim().min(3).max(40),
  token: z.string().max(200).nullish(),
  keyId: z.string().min(1).max(64),
  reason: z.enum(Object.keys(CLAIM_REASONS) as [ClaimReason, ...ClaimReason[]]),
  message: z.string().trim().max(1000, "Keep it under 1000 characters"),
});

/** Customer: "this key stopped working" (only the order's owner, only while covered). */
export async function createWarrantyClaim(input: {
  orderNumber: string;
  token?: string | null;
  keyId: string;
  reason: string;
  message: string;
}): Promise<ClaimResult> {
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;

  const order = await getOrderByNumber(d.orderNumber);
  // Proof of ownership: the private link from their email, or being signed in.
  const allowed =
    order &&
    (canViewOrder(order, { token: d.token ?? null, orderNumber: d.orderNumber }) ||
      canViewOrder(order, { session: await auth(), orderNumber: d.orderNumber }));
  if (!order || !allowed) return { ok: false, error: "We couldn't find that order." };
  if (order.status !== "FULFILLED") return { ok: false, error: "Only delivered orders can be claimed." };

  const item = order.items.find((i) => i.licenseKeys.some((k) => k.id === d.keyId));
  const key = item?.licenseKeys.find((k) => k.id === d.keyId);
  if (!item || !key || key.status !== "SOLD" || key.replacedAt) {
    return { ok: false, error: "That key isn't part of this order." };
  }
  const [product, activations] = await Promise.all([
    prisma.product.findUnique({ where: { id: item.productId }, select: { deliveryType: true } }),
    prisma.activationRequest.findMany({ where: { keyId: key.id }, select: { status: true, resolvedAt: true } }),
  ]);
  const { start, awaitingActivation } = checkStart(product?.deliveryType ?? "KEY", key.soldAt, activations);
  const cover = keyCover(item, start, await getFreeCheckHours(), new Date(), { awaitingActivation });
  if (!cover) {
    return {
      ok: false,
      error: item.warrantyName
        ? "The warranty for this key has ended. Reply to your order email and we'll still try to help."
        : "The check period for this key has ended. Reply to your order email and we'll still try to help.",
    };
  }

  const open = await prisma.warrantyClaim.findFirst({ where: { keyId: key.id, status: "OPEN" }, select: { id: true } });
  if (open) return { ok: true, message: "We already have a claim for this key and are looking into it." };

  if (!(await rateLimit(`claim:${order.id}`, 5, 24 * 3600))) {
    return { ok: false, error: "Too many claims on this order today. Please reply to your order email instead." };
  }

  await prisma.warrantyClaim.create({
    data: { orderItemId: item.id, keyId: key.id, reason: d.reason, message: d.message || null, coverage: cover.kind },
  });

  const reasonLabel = CLAIM_REASONS[d.reason];
  await sendAlert({
    type: "WARRANTY_CLAIM",
    subject: `Key claim: ${item.productName} (order ${order.orderNumber})`,
    lines: [
      `${order.email} says their ${item.productName} key isn't working.`,
      ``,
      `Problem: ${reasonLabel}`,
      `Message: ${d.message || "(none)"}`,
      `Cover: ${cover.kind === "WARRANTY" ? (warrantySummary(item) ?? "Warranty") : "Free check period after delivery"}`,
      ``,
      `Review it and send a replacement, refund or reply: ${SITE_URL}/admin/warranty/claims`,
    ],
    dedupeKey: `claim:${key.id}`,
    cooldownHours: 1,
  });
  try {
    await sendWarrantyClaimReceivedEmail(order.email, {
      orderNumber: order.orderNumber,
      productName: item.productName,
      reasonLabel,
    });
  } catch (err) {
    console.error("[warranty-claim] confirmation email failed", err);
  }

  revalidatePath("/admin/warranty/claims");
  revalidatePath("/admin");
  return { ok: true, message: "Thanks. We'll check the key and email you, usually within 24 hours." };
}

/** Admin: close a claim (replace / refund / reject). See resolveClaim. */
export async function resolveWarrantyClaim(_prev: ClaimResult | null, formData: FormData): Promise<ClaimResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const result = await resolveClaim({
    claimId: String(formData.get("claimId") ?? ""),
    action: String(formData.get("action") ?? ""),
    note: String(formData.get("note") ?? ""),
    refundAmount: String(formData.get("refundAmount") ?? ""),
    adminEmail: admin.user.email ?? null,
  });
  revalidatePath("/admin/warranty/claims");
  if (result.orderNumber) revalidatePath(`/admin/orders/${result.orderNumber}`);
  revalidatePath("/admin");
  return result.ok ? { ok: true, message: result.message } : { ok: false, error: result.error };
}
