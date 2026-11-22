"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin";
import { canViewOrder, getOrderByNumber } from "@/lib/orders";
import { sendAlert } from "@/lib/alerts";
import { rateLimit } from "@/lib/rate-limit";
import { resolveActivation } from "@/lib/activation";
import {
  ACTIVATION_LIMIT,
  ACTIVATION_REPLY_TIME,
  cleanInstallationId,
  formatActivationId,
} from "@/lib/delivery";

export type ActivationResult = { ok: true; message: string } | { ok: false; error: string };

const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const requestSchema = z.object({
  orderNumber: z.string().trim().min(3).max(40),
  token: z.string().max(200).nullish(),
  keyId: z.string().min(1).max(64),
  installationId: z.string().max(200),
});

/** Customer: "here is my Installation ID, please send the Confirmation ID". */
export async function requestActivation(input: {
  orderNumber: string;
  token?: string | null;
  keyId: string;
  installationId: string;
}): Promise<ActivationResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the form." };
  const d = parsed.data;

  const installationId = cleanInstallationId(d.installationId);
  if (!installationId) {
    return {
      ok: false,
      error: "That doesn't look like a full Installation ID. It has 63 digits (9 groups of 7). Copy every group.",
    };
  }

  const order = await getOrderByNumber(d.orderNumber);
  // Proof of ownership: the private link from their email, or being signed in.
  const allowed =
    order &&
    (canViewOrder(order, { token: d.token ?? null, orderNumber: d.orderNumber }) ||
      canViewOrder(order, { session: await auth(), orderNumber: d.orderNumber }));
  if (!order || !allowed) return { ok: false, error: "We couldn't find that order." };
  if (order.status !== "FULFILLED") return { ok: false, error: "This order hasn't been delivered." };

  const item = order.items.find((i) => i.licenseKeys.some((k) => k.id === d.keyId));
  const key = item?.licenseKeys.find((k) => k.id === d.keyId);
  if (!item || !key || key.status !== "SOLD" || key.replacedAt) {
    return { ok: false, error: "That key isn't part of this order." };
  }
  const product = await prisma.product.findUnique({ where: { id: item.productId }, select: { deliveryType: true } });
  if (product?.deliveryType !== "PHONE") return { ok: false, error: "This key doesn't need phone activation." };

  const previous = await prisma.activationRequest.findMany({
    where: { keyId: key.id },
    select: { status: true, installationId: true },
  });
  if (previous.some((p) => p.status === "OPEN")) {
    return { ok: true, message: "We already have a request for this key and will reply soon." };
  }
  const done = previous.find((p) => p.status === "DONE" && p.installationId === installationId);
  if (done) {
    return { ok: false, error: "We already sent the Confirmation ID for this Installation ID. It's shown under your key." };
  }
  const used = previous.filter((p) => p.status !== "REJECTED").length;
  if (used >= ACTIVATION_LIMIT + key.extraActivations) {
    return {
      ok: false,
      error: "You've used all activation requests for this key. Reply to your order email and we'll help.",
    };
  }
  if (!(await rateLimit(`activation:${order.id}`, 10, 24 * 3600))) {
    return { ok: false, error: "Too many requests on this order today. Please reply to your order email instead." };
  }

  await prisma.activationRequest.create({ data: { keyId: key.id, installationId } });

  await sendAlert({
    type: "ACTIVATION_REQUEST",
    subject: `Phone activation: ${item.productName} (order ${order.orderNumber})`,
    lines: [
      `${order.email} needs a Confirmation ID.`,
      ``,
      `Installation ID: ${formatActivationId(installationId)}`,
      `Request ${used + 1} of ${ACTIVATION_LIMIT + key.extraActivations} for this key.`,
      ``,
      `Send the Confirmation ID here: ${SITE_URL}/admin/activations`,
    ],
    dedupeKey: `activation:${key.id}:${installationId}`,
    cooldownHours: 1,
  });

  revalidatePath("/admin/activations");
  revalidatePath("/admin");
  return { ok: true, message: `Thanks. We'll email you the Confirmation ID, ${ACTIVATION_REPLY_TIME}.` };
}

/** Admin: send the Confirmation ID, or explain why we couldn't. */
export async function answerActivation(_prev: ActivationResult | null, formData: FormData): Promise<ActivationResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };
  const result = await resolveActivation({
    requestId: String(formData.get("requestId") ?? ""),
    action: String(formData.get("action") ?? ""),
    confirmationId: String(formData.get("confirmationId") ?? ""),
    note: String(formData.get("note") ?? ""),
    adminEmail: admin.user.email ?? null,
  });
  revalidatePath("/admin/activations");
  revalidatePath("/admin");
  if (result.orderNumber) revalidatePath(`/admin/orders/${result.orderNumber}`);
  return result.ok ? { ok: true, message: result.message } : { ok: false, error: result.error };
}

/** Admin: let this key send one more request than the limit allows. */
export async function allowExtraActivation(formData: FormData): Promise<void> {
  const admin = await getAdminSession();
  if (!admin) return;
  const keyId = String(formData.get("keyId") ?? "");
  if (!keyId) return;
  await prisma.licenseKey.update({ where: { id: keyId }, data: { extraActivations: { increment: 1 } } });
  revalidatePath("/admin/activations");
}
