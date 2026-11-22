/**
 * Sale (discount) maths. Pure functions, safe on the client and the server.
 * The server decides which sales are live (lib/pricing.ts); this file only
 * picks the best one for a product and applies it.
 */

export const DISCOUNT_MIN_PERCENT = 1;
export const DISCOUNT_MAX_PERCENT = 90;

export type DiscountScope = "ALL" | "CATEGORIES" | "PRODUCTS";

export type ActiveDiscount = {
  id: string;
  name: string;
  percent: number;
  scope: DiscountScope;
  categoryIds: string[];
  productIds: string[];
  endsAt: Date | null;
};

/** What a shopper sees about the sale on a product. */
export type SaleInfo = { percent: number; name: string; endsAt: Date | null };

export function discountApplies(
  d: Pick<ActiveDiscount, "scope" | "categoryIds" | "productIds">,
  product: { id: string; categoryId: string },
): boolean {
  if (d.scope === "ALL") return true;
  if (d.scope === "CATEGORIES") return d.categoryIds.includes(product.categoryId);
  return d.productIds.includes(product.id);
}

/**
 * The biggest live sale covering the product, or null. Sales never stack.
 * Ties go to the one ending soonest (the most urgent message).
 */
export function bestDiscount(
  product: { id: string; categoryId: string },
  discounts: ActiveDiscount[],
): ActiveDiscount | null {
  let best: ActiveDiscount | null = null;
  for (const d of discounts) {
    if (!discountApplies(d, product)) continue;
    if (
      !best ||
      d.percent > best.percent ||
      (d.percent === best.percent &&
        (d.endsAt?.getTime() ?? Infinity) < (best.endsAt?.getTime() ?? Infinity))
    ) {
      best = d;
    }
  }
  return best;
}

/** USD sale price, rounded to the cent. */
export function discountedUsdCents(listCents: number, percent: number): number {
  return Math.round(listCents * (1 - percent / 100));
}

/** LKR sale price, rounded to a whole rupee (like every LKR price). */
export function discountedLkrCents(listCents: number, percent: number): number {
  return Math.round((listCents / 100) * (1 - percent / 100)) * 100;
}

export type DiscountStatus = "active" | "scheduled" | "ended" | "off";

export function discountStatus(
  d: { active: boolean; startsAt: Date | null; endsAt: Date | null },
  now: Date = new Date(),
): DiscountStatus {
  if (!d.active) return "off";
  if (d.endsAt && d.endsAt <= now) return "ended";
  if (d.startsAt && d.startsAt > now) return "scheduled";
  return "active";
}

/** "Ends in 3 days" style text for the shop, or null when there's no end date. */
export function endsInText(endsAt: Date | null, now: Date = new Date()): string | null {
  if (!endsAt) return null;
  const ms = endsAt.getTime() - now.getTime();
  if (ms <= 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "Ends in under an hour";
  if (hours < 24) return `Ends in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `Ends in ${days} day${days === 1 ? "" : "s"}`;
}
