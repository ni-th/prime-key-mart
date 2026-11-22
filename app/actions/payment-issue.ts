"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewOrder, getOrderByNumber } from "@/lib/orders";
import { sendAlert } from "@/lib/alerts";
import { sendPaymentReportReceivedEmail } from "@/lib/mailer";
import { formatMoney } from "@/lib/money";
import { canReportPaymentIssue, FOLLOW_UP_PREFIX, reportView } from "@/lib/payment-issue";

export type ReportResult =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const schema = z.object({
  orderNumber: z.string().trim().min(3).max(40),
  /** Proof of access: the signed link token, or the checkout email (order lookup). */
  token: z.string().max(200).optional(),
  email: z.string().trim().toLowerCase().max(200).optional(),
  paymentRef: z.string().trim().max(80, "Keep the reference under 80 characters"),
  note: z.string().trim().max(1000, "Keep the message under 1000 characters"),
});

const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Customer says they paid but the order isn't delivered (typically the
 * connection dropped after paying, so the payment confirmation never reached
 * us). Flags the order for the admin, alerts them, and emails the customer a
 * confirmation. The admin checks PayHere and delivers from the order page.
 */
export async function reportPaymentIssue(input: {
  orderNumber: string;
  token?: string | null;
  email?: string | null;
  paymentRef: string;
  note: string;
}): Promise<ReportResult> {
  const parsed = schema.safeParse({
    ...input,
    token: input.token ?? undefined,
    email: input.email ?? undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Please check the form.", fieldErrors };
  }
  const d = parsed.data;

  const order = await getOrderByNumber(d.orderNumber);
  // Access: the signed order link, the checkout email (order lookup), or the
  // signed-in owner. The session is only looked up when the others don't match.
  const allowed =
    order &&
    (canViewOrder(order, { token: d.token ?? null, orderNumber: d.orderNumber }) ||
      (d.email !== undefined && d.email === order.email.toLowerCase()) ||
      canViewOrder(order, { session: await auth(), orderNumber: d.orderNumber }));
  if (!order || !allowed) {
    return { ok: false, error: "We couldn't find that order." };
  }

  if (!canReportPaymentIssue(order.status)) {
    return {
      ok: false,
      error:
        order.status === "FULFILLED"
          ? "This order is already delivered. Your keys are in your email and on the order page."
          : "We already know about this order and are working on it.",
    };
  }

  // Already reported and still open: don't spam the admin.
  if (order.issueReportedAt && !order.issueResolvedAt) {
    return {
      ok: true,
      message: "Thanks, we already have your report and are checking your payment.",
    };
  }

  // After the admin closed a report ("no payment found"), one follow-up is
  // allowed (e.g. to send bank evidence); after that, email support.
  const view = reportView(order);
  const followUp = view.closedMessage !== null;
  if (followUp && !view.canFollowUp) {
    return {
      ok: false,
      error: "We've already looked into this order twice. Please reply to our email so we can sort it out.",
    };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      issueReportedAt: new Date(),
      issueNote: followUp ? `${FOLLOW_UP_PREFIX}${d.note}`.trim() : d.note || null,
      issuePaymentRef: d.paymentRef || null,
      issueResolvedAt: null,
      issueResolution: null,
    },
  });

  const currency = order.currency.toUpperCase();
  await sendAlert({
    type: "CUSTOMER_REPORT",
    subject: `${followUp ? "Follow-up: " : ""}Customer says they paid: order ${order.orderNumber}`,
    lines: [
      ...(followUp
        ? [
            `This is a FOLLOW-UP: you closed the first report as not paid with this message:`,
            `"${view.closedMessage}"`,
            ``,
          ]
        : []),
      `${order.email} says they paid for order ${order.orderNumber} (${formatMoney(order.totalCents, currency)}) but didn't get their keys. Order status: ${order.status}.`,
      ``,
      `Payment reference: ${d.paymentRef || "(not given)"}`,
      `Message: ${d.note || "(none)"}`,
      ``,
      `1. Find order ${order.orderNumber} in your PayHere merchant dashboard.`,
      `2. If it was paid, open the order and click "Mark as paid & deliver keys":`,
      `   ${SITE_URL}/admin/orders/${order.orderNumber}`,
      `3. If not, use "Not paid - close report" and let the customer know.`,
    ],
    dedupeKey: `customer-report:${order.orderNumber}${followUp ? ":follow-up" : ""}`,
    cooldownHours: 1,
  });

  try {
    await sendPaymentReportReceivedEmail(order.email, order.orderNumber);
  } catch (err) {
    console.error(`[payment-issue] confirmation email failed for ${order.orderNumber}`, err);
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${order.orderNumber}`);
  revalidatePath("/admin");
  return {
    ok: true,
    message: `Thanks. We're checking your payment and will email your keys to ${order.email} once it's confirmed, usually within a few hours.`,
  };
}
