import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getOrderByNumber, canViewOrder } from "@/lib/orders";
import { fulfillOrder, releaseOrderReservation } from "@/lib/inventory";
import { allowMockPayments } from "@/lib/payhere";

export const runtime = "nodejs";

const bodySchema = z.object({
  orderNumber: z.string().min(1),
  token: z.string().min(1),
  action: z.enum(["pay", "cancel"]),
});

export async function POST(req: Request) {
  if (!allowMockPayments) {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const { orderNumber, token, action } = parsed.data;

  const order = await getOrderByNumber(orderNumber);
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const session = await auth();
  if (!canViewOrder(order, { session, token, orderNumber })) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  if (action === "cancel") {
    await releaseOrderReservation(order.id, "EXPIRED");
    return NextResponse.json({ ok: true, status: "EXPIRED" });
  }

  // Behaves like a real (possibly late) payment confirmation.
  const result = await fulfillOrder(order.id);
  return NextResponse.json({ ok: true, status: result.status });
}
