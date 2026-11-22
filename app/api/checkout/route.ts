import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ADMIN_COST_FIELDS, prisma } from "@/lib/db";
import { asCurrency, convertCost, gatewayFeeCents } from "@/lib/profit";
import { checkoutSchema } from "@/lib/validation";
import { generateOrderNumber } from "@/lib/orders";
import { signOrderToken } from "@/lib/order-token";
import { getActiveDiscounts, getPricingSettings, listPriceIn, priceOf, unitPriceIn } from "@/lib/pricing";
import {
  InsufficientStockError,
  expireStaleReservations,
  releaseOrderReservation,
  reserveKeysForOrder,
} from "@/lib/inventory";
import {
  allowMockPayments,
  createPayHereHash,
  isPayHereConfigured,
  payHereCheckoutUrl,
} from "@/lib/payhere";
import { checkoutBlockReason } from "@/lib/moderation";

export const runtime = "nodejs";

const SITE_URL =
  process.env.SITE_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

export async function POST(req: Request) {
  // No real payment provider and not in local development: refuse, rather
  // than create orders that could only be "paid" through the test flow.
  if (!isPayHereConfigured && !allowMockPayments) {
    console.error("[checkout] PayHere is not configured - refusing orders.");
    return NextResponse.json(
      { error: "Payments are temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }

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

  const blockReason = await checkoutBlockReason(email, session?.user?.id);
  if (blockReason) {
    return NextResponse.json({ error: blockReason }, { status: 403 });
  }

  // Re-price everything from the database - never trust client prices.
  const ids = [...new Set(parsed.data.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, published: true },
    // Cost is snapshotted on the order for admin profit reports (never sent back).
    omit: ADMIN_COST_FIELDS.product,
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  if (parsed.data.items.some((i) => !byId.has(i.productId))) {
    return NextResponse.json(
      { error: "One or more items are no longer available." },
      { status: 409 },
    );
  }

  // Price every line on the server in the chosen currency (fixed LKR price if
  // set, else USD x admin exchange rate + margin). The total is the sum of the
  // line prices, so it always matches what the customer was shown.
  const currency = parsed.data.currency;
  const [settings, discounts] = await Promise.all([getPricingSettings(), getActiveDiscounts()]);
  const lines = parsed.data.items.map((i) => {
    const product = byId.get(i.productId)!;
    const price = priceOf(product, settings, discounts);
    return {
      product,
      quantity: i.quantity,
      unitCents: unitPriceIn(price, currency),
      listCents: listPriceIn(price, currency),
      sale: price.sale,
      unitCostCents:
        product.costCents === null
          ? null
          : convertCost(product.costCents, asCurrency(product.costCurrency), currency, settings.rate),
    };
  });
  const paymentSubtotalCents = lines.reduce((sum, l) => sum + l.unitCents * l.quantity, 0);

  // Return keys held by abandoned checkouts to stock before we try to reserve.
  // Never let housekeeping block a sale.
  await expireStaleReservations().catch((err) =>
    console.error("[checkout] expiring stale reservations failed", err),
  );

  const orderNumber = generateOrderNumber();
  const order = await prisma.order.create({
    data: {
      orderNumber,
      email,
      userId: session?.user?.id ?? null,
      status: "PENDING",
      subtotalCents: paymentSubtotalCents,
      totalCents: paymentSubtotalCents,
      feeCents: gatewayFeeCents(paymentSubtotalCents, settings.gatewayFeePercent),
      currency: currency.toLowerCase(),
      items: {
        create: lines.map((l) => ({
          productId: l.product.id,
          productName: l.product.name,
          unitPriceCents: l.unitCents,
          unitCostCents: l.unitCostCents,
          listPriceCents: l.listCents,
          discountPercent: l.sale?.percent ?? null,
          discountName: l.sale?.name ?? null,
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

  // --- Mock payment (local development only, PayHere not configured) ----------
  if (allowMockPayments) {
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
        cancel_url: `${SITE_URL}/checkout/cancel?order=${orderNumber}&t=${token}`,
        notify_url: `${SITE_URL}/api/webhooks/payhere`,
        order_id: orderNumber,
        items: lines.map((l) => `${l.product.name} x ${l.quantity}`).join(", "),
        currency,
        amount,
        first_name: "Keysby",
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
