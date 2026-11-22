/**
 * Warranty maths (pure, safe on client and server). A warranty plan costs a
 * percent of the product's NORMAL price (before any sale), so sales discount
 * the product but never the warranty. LKR rounds to whole rupees like every
 * LKR price.
 */

export const WARRANTY_MAX_PERCENT = 100;

export type WarrantyOption = {
  planId: string;
  name: string;
  description: string | null;
  /** Days of cover; null = lifetime. */
  days: number | null;
  /** Effective percent for this product (store % or the product's override). */
  percent: number;
  isDefault: boolean;
  recommended: boolean;
};

/** A plan with its price for one product, in both currencies (cents). */
export type PricedWarranty = WarrantyOption & { usdCents: number; lkrCents: number };

export function warrantyUsdCents(listUsdCents: number, percent: number): number {
  return Math.round((listUsdCents * percent) / 100);
}

export function warrantyLkrCents(listLkrCents: number, percent: number): number {
  return Math.round(((listLkrCents / 100) * percent) / 100) * 100;
}

export function priceWarranties(
  options: WarrantyOption[],
  list: { usdCents: number; lkrCents: number },
): PricedWarranty[] {
  return options.map((o) => ({
    ...o,
    usdCents: warrantyUsdCents(list.usdCents, o.percent),
    lkrCents: warrantyLkrCents(list.lkrCents, o.percent),
  }));
}

/**
 * The plan to use for a line: the one asked for if this product offers it,
 * else the default (included) plan, else the first offered, else none.
 */
export function resolveWarranty<T extends WarrantyOption>(options: T[], requestedId?: string | null): T | null {
  return (
    (requestedId ? options.find((o) => o.planId === requestedId) : undefined) ??
    options.find((o) => o.isDefault) ??
    options[0] ??
    null
  );
}

/** "7 days", "30 days", "6 months", "1 year", "2 years", "Lifetime". */
export function warrantyLength(days: number | null): string {
  if (days === null) return "Lifetime";
  if (days >= 365 && days % 365 === 0) {
    const years = days / 365;
    return `${years} year${years === 1 ? "" : "s"}`;
  }
  // Whole months from 60 days up read better ("3 months"); 30 stays "30 days".
  if (days >= 60 && days % 30 === 0) return `${days / 30} months`;
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** Expiry for a warranty that starts now (null = lifetime). */
export function warrantyExpiry(days: number | null, from: Date = new Date()): Date | null {
  if (days === null) return null;
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/** A placed order line's total: product (after sale) + warranty, times quantity. */
export function orderLineTotalCents(item: {
  unitPriceCents: number;
  warrantyCents?: number | null;
  quantity: number;
}): number {
  return (item.unitPriceCents + (item.warrantyCents ?? 0)) * item.quantity;
}

/** "1 year warranty, until 22 Nov 2027" / "Lifetime warranty" / "30 days warranty". */
export function warrantySummary(item: {
  warrantyName?: string | null;
  warrantyDays?: number | null;
  warrantyExpiresAt?: Date | string | null;
}): string | null {
  if (!item.warrantyName) return null;
  const length = warrantyLength(item.warrantyDays ?? null);
  if (item.warrantyExpiresAt) {
    const until = new Date(item.warrantyExpiresAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return `${item.warrantyName} (${length}), until ${until}`;
  }
  return item.warrantyDays === null ? `${item.warrantyName} (lifetime)` : `${item.warrantyName} (${length})`;
}
