import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { reportView } from "@/lib/payment-issue";
import { warrantyViewForOrder } from "@/lib/warranty-claims";
import {
  canViewOrder,
  decryptOrderKeys,
  getOrderByNumber,
} from "@/lib/orders";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await params;
  const token = new URL(req.url).searchParams.get("t");

  const order = await getOrderByNumber(orderNumber);
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const session = await auth();
  if (!canViewOrder(order, { session, token, orderNumber })) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const fulfilled = order.status === "FULFILLED";
  return NextResponse.json({
    orderNumber: order.orderNumber,
    status: order.status,
    email: order.email,
    totalCents: order.totalCents,
    /** "Paid but no keys" report state (open, or closed with the admin's message). */
    ...reportView(order),
    items: order.items.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
    })),
    keys: fulfilled ? decryptOrderKeys(order) : null,
    /** Warranty status + claims per delivered item (owner only). */
    warranty: fulfilled ? await warrantyViewForOrder(order.id) : [],
  });
}
