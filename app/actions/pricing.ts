"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { getActiveDiscounts, getPricingSettings, priceOf } from "@/lib/pricing";

const quoteSchema = z
  .array(z.object({ productId: z.string().min(1).max(64), quantity: z.number().int().min(1).max(10) }))
  .max(50);

export type CartQuoteLine = {
  productId: string;
  quantity: number;
  /** Unit prices the customer pays (after any sale). */
  usdCents: number;
  lkrCents: number;
  /** Unit prices before the sale (same as above when not on sale). */
  listUsdCents: number;
  listLkrCents: number;
  /** Percent off from a sale, or null. */
  salePercent: number | null;
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
  const [products, settings, discounts] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: ids }, published: true },
      select: { id: true, categoryId: true, priceCents: true, priceLkrCents: true },
    }),
    getPricingSettings(),
    getActiveDiscounts(),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines = parsed.data.map((l): CartQuoteLine => {
    const p = byId.get(l.productId);
    if (!p) {
      return { ...l, usdCents: 0, lkrCents: 0, listUsdCents: 0, listLkrCents: 0, salePercent: null, available: false };
    }
    const price = priceOf(p, settings, discounts);
    return {
      ...l,
      usdCents: price.usdCents,
      lkrCents: price.lkrCents,
      listUsdCents: price.listUsdCents,
      listLkrCents: price.listLkrCents,
      salePercent: price.sale?.percent ?? null,
      available: true,
    };
  });

  const totals = lines.reduce(
    (t, l) => ({ USD: t.USD + l.usdCents * l.quantity, LKR: t.LKR + l.lkrCents * l.quantity }),
    { USD: 0, LKR: 0 },
  );
  return { lines, totals };
}
