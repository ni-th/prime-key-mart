import { cache } from "react";
import { prisma } from "@/lib/db";
import {
  bestDiscount,
  discountedLkrCents,
  discountedUsdCents,
  type ActiveDiscount,
  type SaleInfo,
} from "@/lib/sale";

/**
 * One place that decides what a product costs, in both currencies. Used by the
 * storefront, cart/checkout quotes and the checkout API (which re-prices on the
 * server, so displayed and charged prices always agree).
 *
 * - USD: Product.priceCents (always set).
 * - LKR: Product.priceLkrCents if the admin set a fixed price, otherwise USD x
 *   exchange rate x (1 + margin), rounded to whole rupees.
 * - Sales: the biggest live Discount covering the product takes a percent off
 *   both (LKR still rounded to whole rupees).
 */

/** Rates outside this range are rejected as typos (e.g. 30 instead of 300). */
export const RATE_MIN = 150;
export const RATE_MAX = 600;
export const MARGIN_MAX = 20;
/** Warn in admin when a fixed LKR price is this far from the calculated one. */
export const LKR_DRIFT_WARN_PERCENT = 10;

export type PricingSettings = {
  /** LKR per 1 USD (market). */
  rate: number;
  /** Percent added on top of `rate` for calculated LKR prices. */
  marginPercent: number;
  /** Payment gateway fee percent (admin profit reports only). */
  gatewayFeePercent: number;
  /** Where the rate came from, for the admin page. */
  source: "admin" | "env" | "default";
  updatedAt: Date | null;
  updatedBy: string | null;
};

function envRate(): number | null {
  const n = Number(process.env.PAYHERE_USD_TO_LKR_RATE);
  return Number.isFinite(n) && n >= RATE_MIN && n <= RATE_MAX ? n : null;
}

/** Current pricing settings (admin value, else env, else 300). Cached per request. */
export const getPricingSettings = cache(async (): Promise<PricingSettings> => {
  const row = await prisma.storeSettings.findUnique({ where: { id: "default" } });
  const admin = row?.usdToLkrRate ?? null;
  const env = envRate();
  return {
    rate: admin ?? env ?? 300,
    marginPercent: row?.lkrMarginPercent ?? 0,
    gatewayFeePercent: row?.gatewayFeePercent ?? 0,
    source: admin ? "admin" : env ? "env" : "default",
    updatedAt: row?.updatedAt ?? null,
    updatedBy: row?.updatedBy ?? null,
  };
});

/** Effective LKR per USD including the margin. */
export function effectiveRate(s: Pick<PricingSettings, "rate" | "marginPercent">): number {
  return s.rate * (1 + s.marginPercent / 100);
}

/** USD cents -> LKR cents at the effective rate, rounded to a whole rupee. */
export function calculatedLkrCents(
  usdCents: number,
  s: Pick<PricingSettings, "rate" | "marginPercent">,
): number {
  const lkr = (usdCents / 100) * effectiveRate(s);
  return Math.round(lkr) * 100;
}

export type ProductPrice = {
  /** What the customer pays (after any sale). */
  usdCents: number;
  lkrCents: number;
  /** Normal prices, before any sale. Equal to the above when not on sale. */
  listUsdCents: number;
  listLkrCents: number;
  /** True when LKR is a fixed admin-set price rather than calculated. */
  lkrFixed: boolean;
  /** The sale applied, or null. */
  sale: SaleInfo | null;
};

/**
 * Sales running right now, with what they cover. Cached per request.
 * Scheduled sales start and stop on their own: every shop page is rendered
 * per request, so no cron job or redeploy is needed.
 */
export const getActiveDiscounts = cache(async (): Promise<ActiveDiscount[]> => {
  const now = new Date();
  const rows = await prisma.discount.findMany({
    where: {
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    },
    include: { categories: { select: { id: true } }, products: { select: { id: true } } },
  });
  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    percent: d.percent,
    scope: d.scope,
    categoryIds: d.categories.map((c) => c.id),
    productIds: d.products.map((p) => p.id),
    endsAt: d.endsAt,
  }));
});

/**
 * Price of a product in both currencies. Pass `discounts` (from
 * getActiveDiscounts) to apply sales; the product then needs id + categoryId.
 */
export function priceOf(
  product: { priceCents: number; priceLkrCents: number | null; id?: string; categoryId?: string },
  s: Pick<PricingSettings, "rate" | "marginPercent">,
  discounts?: ActiveDiscount[],
): ProductPrice {
  const fixed = product.priceLkrCents;
  const listUsdCents = product.priceCents;
  const listLkrCents = fixed ?? calculatedLkrCents(product.priceCents, s);
  const d =
    discounts && product.id && product.categoryId
      ? bestDiscount({ id: product.id, categoryId: product.categoryId }, discounts)
      : null;
  return {
    usdCents: d ? discountedUsdCents(listUsdCents, d.percent) : listUsdCents,
    lkrCents: d ? discountedLkrCents(listLkrCents, d.percent) : listLkrCents,
    listUsdCents,
    listLkrCents,
    lkrFixed: fixed !== null,
    sale: d ? { percent: d.percent, name: d.name, endsAt: d.endsAt } : null,
  };
}

/** Normal price in the checkout currency (before any sale). */
export function listPriceIn(price: ProductPrice, currency: "LKR" | "USD"): number {
  return currency === "LKR" ? price.listLkrCents : price.listUsdCents;
}

/** Unit price in the checkout currency. */
export function unitPriceIn(price: ProductPrice, currency: "LKR" | "USD"): number {
  return currency === "LKR" ? price.lkrCents : price.usdCents;
}
