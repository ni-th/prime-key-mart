import { cache } from "react";
import { prisma } from "@/lib/db";

/**
 * One place that decides what a product costs, in both currencies. Used by the
 * storefront, cart/checkout quotes and the checkout API (which re-prices on the
 * server, so displayed and charged prices always agree).
 *
 * - USD: Product.priceCents (always set).
 * - LKR: Product.priceLkrCents if the admin set a fixed price, otherwise USD x
 *   exchange rate x (1 + margin), rounded to whole rupees.
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
  usdCents: number;
  lkrCents: number;
  /** True when LKR is a fixed admin-set price rather than calculated. */
  lkrFixed: boolean;
};

export function priceOf(
  product: { priceCents: number; priceLkrCents: number | null },
  s: Pick<PricingSettings, "rate" | "marginPercent">,
): ProductPrice {
  const fixed = product.priceLkrCents;
  return {
    usdCents: product.priceCents,
    lkrCents: fixed ?? calculatedLkrCents(product.priceCents, s),
    lkrFixed: fixed !== null,
  };
}

/** Unit price in the checkout currency. */
export function unitPriceIn(price: ProductPrice, currency: "LKR" | "USD"): number {
  return currency === "LKR" ? price.lkrCents : price.usdCents;
}
