import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { canViewOrder, getOrderByNumber } from "@/lib/orders";
import { releaseOrderReservation } from "@/lib/inventory";

export const runtime = "nodejs";

const schema = z.object({
  orderNumber: z.string().trim().min(3).max(40),
  token: z.string().max(200).nullable().optional(),
});

/**
 * The customer came back to the store without paying (Back button from
 * PayHere, a payment PayHere refused, a closed tab reopened): hand that
 * checkout's keys back to stock now. Needs the order's signed token or the
 * owner's session, like the cancel page. Only PENDING orders are affected,
 * and a payment that does arrive later re-reserves keys (fulfillOrder).
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { orderNumber, token } = parsed.data;

  const order = await getOrderByNumber(orderNumber);
  if (!order) return NextResponse.json({ released: false });
  const session = await auth();
  if (!canViewOrder(order, { session, token: token ?? null, orderNumber })) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  const released = await releaseOrderReservation(order.id, "EXPIRED");
  return NextResponse.json({ released });
}
