import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fulfillOrder, releaseOrderReservation } from "@/lib/inventory";
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
    return NextResponse.json({ error: "Invalid PayHere signature." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: fields.order_id },
    select: { id: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  if (fields.status_code === "2") {
    await fulfillOrder(order.id);
  } else if (["-1", "-2", "-3"].includes(fields.status_code)) {
    await releaseOrderReservation(order.id, "FAILED");
  }

  return NextResponse.json({ received: true });
}
