import { formatMoney } from "@/lib/money";

/** Safe to import anywhere (checkout form and server). */
export type Currency = "LKR" | "USD";
export type PaymentLimits = Record<Currency, number | null>;

/** Customer-facing reason a payment is over the limit, or null if it's fine. */
export function paymentLimitError(
  totalCents: number,
  currency: Currency,
  limits: PaymentLimits,
): string | null {
  const limit = limits[currency];
  if (limit === null || totalCents <= limit) return null;
  return `Orders over ${formatMoney(limit, currency)} can't be paid in one payment. Please remove some items and place them as a separate order, or contact us.`;
}
