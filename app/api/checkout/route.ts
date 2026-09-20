import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkoutSchema } from "@/lib/validation";
import { generateOrderNumber } from "@/lib/orders";
import { signOrderToken } from "@/lib/order-token";
import { convertUsdCentsToCurrency } from "@/lib/payhere";
import {
  InsufficientStockError,
  releaseOrderReservation,
  reserveKeysForOrder,
} from "@/lib/inventory";
import { createPayHereHash, isPayHereConfigured, payHereCheckoutUrl } from "@/lib/payhere";

export const runtime = "nodejs";

const SITE_URL =
  process.env.SITE_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

export async function POST(req: Request) {
  const session = await auth();

  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }

  const email = (session?.user?.email ?? parsed.data.email)?.toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "An email address is required." },
      { status: 400 },
    );
  }

  // Re-price everything from the database — never trust client prices.
  const ids = [...new Set(parsed.data.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, published: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines = parsed.data.items.map((i) => {
    const product = byId.get(i.productId);
    if (!product) throw new Error("missing");
    return { product, quantity: i.quantity };
  });

  if (lines.some((l) => !l.product)) {
    return NextResponse.json(
      { error: "One or more items are no longer available." },
      { status: 409 },
    );
  }

  const subtotalCents = lines.reduce(
    (sum, l) => sum + l.product.priceCents * l.quantity,
    0,
  );
  const currency = parsed.data.currency;
  const paymentSubtotalCents = convertUsdCentsToCurrency(subtotalCents, currency);

  const orderNumber = generateOrderNumber();
  const order = await prisma.order.create({
    data: {
      orderNumber,
      email,
      userId: session?.user?.id ?? null,
      status: "PENDING",
      subtotalCents: paymentSubtotalCents,
      totalCents: paymentSubtotalCents,
      currency: currency.toLowerCase(),
      items: {
        create: lines.map((l) => ({
          productId: l.product.id,
          productName: l.product.name,
          unitPriceCents: convertUsdCentsToCurrency(l.product.priceCents, currency),
          quantity: l.quantity,
        })),
      },
    },
  });

  try {
    await reserveKeysForOrder(order.id);
  } catch (err) {
    await releaseOrderReservation(order.id, "FAILED");
    if (err instanceof InsufficientStockError) {
      return NextResponse.json(
        { error: `Sorry, "${err.productName}" just went out of stock.` },
        { status: 409 },
      );
    }
    console.error("[checkout] reservation failed", err);
    return NextResponse.json(
      { error: "Could not reserve your keys. Please try again." },
      { status: 500 },
    );
  }

  const token = signOrderToken(orderNumber);

  // --- Mock payment (PayHere credentials are not configured) -------------------
  if (!isPayHereConfigured) {
    return NextResponse.json({
      url: `/checkout/mock?order=${orderNumber}&t=${token}`,
      mock: true,
    });
  }

  // PayHere requires customer details that this temporary checkout does not
  // collect yet. Replace these values when phone/address fields are added.
  try {
    const amount = (paymentSubtotalCents / 100).toFixed(2);
    return NextResponse.json({
      url: payHereCheckoutUrl,
      fields: {
        merchant_id: process.env.PAYHERE_MERCHANT_ID,
        return_url: `${SITE_URL}/checkout/success?order=${orderNumber}&t=${token}`,
        cancel_url: `${SITE_URL}/checkout/cancel?order=${orderNumber}`,
        notify_url: `${SITE_URL}/api/webhooks/payhere`,
        order_id: orderNumber,
        items: lines.map((l) => `${l.product.name} x ${l.quantity}`).join(", "),
        currency,
        amount,
        first_name: "KeyMart",
        last_name: "Customer",
        email,
        phone: "0000000000",
        address: "Digital delivery",
        city: "Colombo",
        country: "Sri Lanka",
        hash: createPayHereHash({ orderId: orderNumber, amount, currency }),
      },
    });
  } catch (err) {
    await releaseOrderReservation(order.id, "FAILED");
    console.error("[checkout] PayHere session failed", err);
    return NextResponse.json(
      { error: "Payment could not be started. Please try again." },
      { status: 502 },
    );
  }
}
