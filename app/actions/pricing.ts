"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { getActiveDiscounts, getPricingSettings, priceOf } from "@/lib/pricing";
import { availableStockByProduct } from "@/lib/products";
import { getWarrantyOptions } from "@/lib/warranty-server";
import { priceWarranties, resolveWarranty, type PricedWarranty } from "@/lib/warranty";

const quoteSchema = z
  .array(
    z.object({
      productId: z.string().min(1).max(64),
      quantity: z.number().int().min(1).max(10),
      warrantyPlanId: z.string().min(1).max(64).nullish(),
    }),
  )
  .max(50);

export type CartQuoteLine = {
  productId: string;
  quantity: number;
  /** Unit prices the customer pays for the product (after any sale), without warranty. */
  usdCents: number;
  lkrCents: number;
  /** Unit prices before the sale (same as above when not on sale). */
  listUsdCents: number;
  listLkrCents: number;
  /** Percent off from a sale, or null. */
  salePercent: number | null;
  /** The warranty applied to this line (per unit prices), or null if none offered. */
  warranty: PricedWarranty | null;
  /** Every warranty this product offers, priced, for the plan picker. */
  warrantyOptions: PricedWarranty[];
  /** False when the product was removed or unpublished. */
  available: boolean;
  /** Keys in stock right now (0 when unavailable). */
  stock: number;
  /** Product image for the cart thumbnail, if set. */
  imageUrl: string | null;
};

export type CartQuote = {
  lines: CartQuoteLine[];
  /** Grand totals including warranties. */
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
  const [products, settings, discounts, stock, warranties] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: ids }, published: true },
      select: { id: true, categoryId: true, priceCents: true, priceLkrCents: true, imageUrl: true },
    }),
    getPricingSettings(),
    getActiveDiscounts(),
    availableStockByProduct(ids),
    getWarrantyOptions(ids),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines = parsed.data.map((l): CartQuoteLine => {
    const base = { productId: l.productId, quantity: l.quantity };
    const p = byId.get(l.productId);
    if (!p) {
      return {
        ...base,
        usdCents: 0,
        lkrCents: 0,
        listUsdCents: 0,
        listLkrCents: 0,
        salePercent: null,
        warranty: null,
        warrantyOptions: [],
        available: false,
        stock: 0,
        imageUrl: null,
      };
    }
    const price = priceOf(p, settings, discounts);
    const options = priceWarranties(warranties.get(p.id) ?? [], {
      usdCents: price.listUsdCents,
      lkrCents: price.listLkrCents,
    });
    return {
      ...base,
      usdCents: price.usdCents,
      lkrCents: price.lkrCents,
      listUsdCents: price.listUsdCents,
      listLkrCents: price.listLkrCents,
      salePercent: price.sale?.percent ?? null,
      warranty: resolveWarranty(options, l.warrantyPlanId),
      warrantyOptions: options,
      available: true,
      stock: stock.get(p.id) ?? 0,
      imageUrl: p.imageUrl,
    };
  });

  const totals = lines.reduce(
    (t, l) => ({
      USD: t.USD + (l.usdCents + (l.warranty?.usdCents ?? 0)) * l.quantity,
      LKR: t.LKR + (l.lkrCents + (l.warranty?.lkrCents ?? 0)) * l.quantity,
    }),
    { USD: 0, LKR: 0 },
  );
  return { lines, totals };
}
