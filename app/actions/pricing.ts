"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { getPricingSettings, priceOf } from "@/lib/pricing";

const quoteSchema = z
  .array(z.object({ productId: z.string().min(1).max(64), quantity: z.number().int().min(1).max(10) }))
  .max(50);

export type CartQuoteLine = {
  productId: string;
  quantity: number;
  usdCents: number;
  lkrCents: number;
  available: boolean;
};

export type CartQuote = {
  lines: CartQuoteLine[];
  totals: { USD: number; LKR: number };
};

/**
 * Current prices for the cart, in both currencies. The cart in the browser
 * only remembers what was added; prices always come from here (and are
 * re-checked by the checkout API), so a changed rate or price is never stale.
 */
export async function quoteCart(input: unknown): Promise<CartQuote> {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return { lines: [], totals: { USD: 0, LKR: 0 } };

  const ids = [...new Set(parsed.data.map((l) => l.productId))];
  const [products, settings] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: ids }, published: true },
      select: { id: true, priceCents: true, priceLkrCents: true },
    }),
    getPricingSettings(),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines = parsed.data.map((l): CartQuoteLine => {
    const p = byId.get(l.productId);
    if (!p) return { ...l, usdCents: 0, lkrCents: 0, available: false };
    const price = priceOf(p, settings);
    return { ...l, usdCents: price.usdCents, lkrCents: price.lkrCents, available: true };
  });

  const totals = lines.reduce(
    (t, l) => ({ USD: t.USD + l.usdCents * l.quantity, LKR: t.LKR + l.lkrCents * l.quantity }),
    { USD: 0, LKR: 0 },
  );
  return { lines, totals };
}
