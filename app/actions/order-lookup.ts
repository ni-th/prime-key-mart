"use server";

import { after } from "next/server";
import { z } from "zod";
import { lookupGuestOrder } from "@/lib/orders";
import { sendOrderKeysEmail, sendOrderStatusEmail } from "@/lib/mailer";
import { clientIp, countHits, rateLimit, recordHits } from "@/lib/rate-limit";
import { sendAlert } from "@/lib/alerts";

const schema = z.object({
  orderNumber: z.string().trim().toUpperCase().min(3).max(40),
  email: z.email(),
});

export type LookupState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "blocked" }
  | { status: "error"; message: string };

/** Lookups per visitor (IP) per hour, matched or not. */
const IP_LIMIT = 20;
/** Emails per order per hour (caps how often one order can be re-sent). */
const ORDER_EMAIL_LIMIT = 3;
/** Failed lookups (number + email don't match) before lookups are blocked... */
const MAX_FAILED_LOOKUPS = 5;
/** ...for this long. */
const FAILED_WINDOW_SECONDS = 24 * 3600;

const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Find my order. Never shows the order on the page: if the order number and
 * email match, the order is EMAILED to that address (keys if delivered,
 * otherwise its status and a private link). The reply is the same whether it
 * matched or not.
 *
 * Failed lookups (number + email don't match) are counted per email, per IP
 * and per order number; after MAX_FAILED_LOOKUPS on any of them in 24 hours,
 * lookups are blocked and the visitor is asked to contact us. Per email stops
 * someone switching devices/networks to target one customer; per IP stops one
 * device trying many emails; per order stops many of both targeting one order.
 */
export async function lookupOrderAction(
  _prev: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const parsed = schema.safeParse({
    orderNumber: formData.get("orderNumber"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Enter your order number and a valid email address." };
  }
  const { orderNumber } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  const ip = await clientIp();

  if (!(await rateLimit(`lookup-ip:${ip}`, IP_LIMIT, 3600))) {
    return { status: "error", message: "Too many lookups. Please try again in an hour." };
  }

  const failKeys = [
    `lookup-fail-email:${email}`,
    `lookup-fail-ip:${ip}`,
    `lookup-fail-order:${orderNumber}`,
  ];
  const failCounts = await Promise.all(failKeys.map((k) => countHits(k, FAILED_WINDOW_SECONDS)));
  if (failCounts.some((n) => n >= MAX_FAILED_LOOKUPS)) return { status: "blocked" };

  const order = await lookupGuestOrder(orderNumber, email);

  if (!order) {
    await recordHits(failKeys);
    const reachedLimit = failCounts.some((n) => n + 1 >= MAX_FAILED_LOOKUPS);
    if (reachedLimit) {
      // Tell the store owner, in case it's a real order being targeted.
      after(() =>
        sendAlert({
          type: "SECURITY",
          subject: `Find my order blocked after ${MAX_FAILED_LOOKUPS} failed attempts`,
          lines: [
            `Find my order was blocked for 24 hours after ${MAX_FAILED_LOOKUPS} lookups where the order number and email didn't match.`,
            ``,
            `Last attempt: order number "${orderNumber}", email ${email}, IP ${ip}.`,
            ``,
            `Usually a customer who forgot which email they used (they'll contact you). Many of these in a row can mean someone is guessing; no order details were shown either way.`,
            `${SITE_URL}/admin/orders?q=${encodeURIComponent(orderNumber)}`,
          ],
          dedupeKey: `lookup-blocked:${email}`,
          cooldownHours: 24,
        }).then(() => undefined),
      );
      return { status: "blocked" };
    }
    // Same reply as a match: don't reveal which orders exist.
    return { status: "sent", email };
  }

  // Matched: send after the response.
  after(async () => {
    try {
      if (!(await rateLimit(`lookup-order:${order.orderNumber}`, ORDER_EMAIL_LIMIT, 3600))) return;
      if (order.status === "FULFILLED") await sendOrderKeysEmail(order.orderNumber);
      else await sendOrderStatusEmail(order);
    } catch (err) {
      console.error("[order-lookup] sending failed", err);
    }
  });

  return { status: "sent", email };
}
