import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkoutSchema } from "@/lib/validation";
import { generateOrderNumber } from "@/lib/orders";
import { signOrderToken } from "@/lib/order-token";
import {
  InsufficientStockError,
  releaseOrderReservation,
  reserveKeysForOrder,
} from "@/lib/inventory";
import { isStripeConfigured, stripe } from "@/lib/stripe";

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

  const orderNumber = generateOrderNumber();
  const order = await prisma.order.create({
    data: {
      orderNumber,
      email,
      userId: session?.user?.id ?? null,
      status: "PENDING",
      subtotalCents,
      totalCents: subtotalCents,
      currency: "usd",
      items: {
        create: lines.map((l) => ({
          productId: l.product.id,
          productName: l.product.name,
          unitPriceCents: l.product.priceCents,
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

  // --- Mock payment (no Stripe key configured) ---------------------------------
  if (!isStripeConfigured || !stripe) {
    return NextResponse.json({
      url: `/checkout/mock?order=${orderNumber}&t=${token}`,
      mock: true,
    });
  }

  // --- Real Stripe Checkout ---------------------------------------------------
  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      client_reference_id: orderNumber,
      metadata: { orderNumber },
      line_items: lines.map((l) => ({
        quantity: l.quantity,
        price_data: {
          currency: "usd",
          unit_amount: l.product.priceCents,
          product_data: {
            name: l.product.name,
            description: l.product.shortDescription,
          },
        },
      })),
      success_url: `${SITE_URL}/checkout/success?order=${orderNumber}&t=${token}`,
      cancel_url: `${SITE_URL}/checkout/cancel?order=${orderNumber}`,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: checkout.id },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    await releaseOrderReservation(order.id, "FAILED");
    console.error("[checkout] stripe session failed", err);
    return NextResponse.json(
      { error: "Payment could not be started. Please try again." },
      { status: 502 },
    );
  }
}
