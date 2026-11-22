import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fulfillOrder, releaseOrderReservation } from "@/lib/inventory";
import { sendAlert } from "@/lib/alerts";
import { formatMoney } from "@/lib/money";
import {
  isPayHereConfigured,
  isValidPayHereNotification,
} from "@/lib/payhere";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isPayHereConfigured) {
    return NextResponse.json({ error: "PayHere is not configured." }, { status: 501 });
  }

  const form = await req.formData();
  const fields = {
    merchant_id: String(form.get("merchant_id") ?? ""),
    order_id: String(form.get("order_id") ?? ""),
    payhere_amount: String(form.get("payhere_amount") ?? ""),
    payhere_currency: String(form.get("payhere_currency") ?? ""),
    status_code: String(form.get("status_code") ?? ""),
    md5sig: String(form.get("md5sig") ?? ""),
  };

  if (!isValidPayHereNotification(fields)) {
    // Either a misconfigured merchant secret or someone faking notifications.
    await sendAlert({
      type: "PAYMENT_PROBLEM",
      subject: "Rejected a payment notification with a bad signature",
      lines: [
        `A PayHere notification for order "${fields.order_id || "(none)"}" was rejected: its signature did not match.`,
        ``,
        `If real payments are affected, check PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET. Otherwise someone may be sending fake notifications; no order was changed.`,
      ],
      dedupeKey: "payhere:bad-signature",
      cooldownHours: 1,
    });
    return NextResponse.json({ error: "Invalid PayHere signature." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: fields.order_id },
    select: { id: true, orderNumber: true, totalCents: true, currency: true, status: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const orderCurrency = order.currency.toUpperCase();
  const paidCents = Math.round(Number.parseFloat(fields.payhere_amount) * 100);
  const amountMatches =
    fields.payhere_currency.toUpperCase() === orderCurrency && paidCents === order.totalCents;

  if (fields.status_code === "2" && !amountMatches) {
    // Never deliver keys for a payment that doesn't match the order.
    await sendAlert({
      type: "PAYMENT_PROBLEM",
      subject: `Payment amount mismatch on order ${order.orderNumber}`,
      lines: [
        `PayHere reported a successful payment of ${fields.payhere_amount} ${fields.payhere_currency} for order ${order.orderNumber}, but the order total is ${formatMoney(order.totalCents, orderCurrency)}.`,
        ``,
        `The keys were NOT delivered. Check the payment in PayHere: if it is genuine, use "Mark as paid & deliver keys" on the order; otherwise refund it.`,
      ],
      dedupeKey: `payhere:mismatch:${order.orderNumber}`,
    });
    return NextResponse.json({ received: true });
  }

  if (fields.status_code === "-3") {
    // Chargeback: the customer disputed a payment with their bank.
    await sendAlert({
      type: "PAYMENT_PROBLEM",
      subject: `Chargeback on order ${order.orderNumber}`,
      lines: [
        `PayHere reported a chargeback (the customer disputed the payment) for order ${order.orderNumber} (${formatMoney(order.totalCents, orderCurrency)}, status ${order.status}).`,
        ``,
        `Check the dispute in PayHere. If the keys were delivered, consider revoking them with the supplier.`,
      ],
      dedupeKey: `payhere:chargeback:${order.orderNumber}`,
    });
  }

  if (fields.status_code === "2") {
    // Handles late payments too: re-reserves keys if the hold had expired, or
    // parks the order as PAID and alerts an admin when stock has run out.
    await fulfillOrder(order.id, {
      paymentRef: String(form.get("payment_id") ?? "") || null,
    });
  } else if (["-1", "-2", "-3"].includes(fields.status_code)) {
    // Only affects PENDING orders - never undoes a confirmed payment.
    await releaseOrderReservation(order.id, "FAILED");
  }

  return NextResponse.json({ received: true });
}
