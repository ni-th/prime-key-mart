/**
 * Profit maths shared by the admin product form (client) and server code.
 * Pure functions only: no database access, safe to import anywhere. Results
 * are only ever rendered on admin pages.
 *
 * profit = price - gateway fee - cost
 *   - gateway fee: a percent of what the customer pays
 *   - cost: what the store paid for the key, converted to the sale currency at
 *     the MARKET rate (no margin: the margin is meant to be earned)
 */

export type Currency = "USD" | "LKR";

export const COST_CURRENCIES = ["USD", "LKR"] as const;
export const FEE_MAX_PERCENT = 15;

/** Gateway fee on an amount, rounded to the nearest cent. */
export function gatewayFeeCents(amountCents: number, feePercent: number): number {
  return Math.round((amountCents * feePercent) / 100);
}

/** Convert a cost to another currency at the market rate (LKR per 1 USD). */
export function convertCost(
  cents: number,
  from: Currency,
  to: Currency,
  rate: number,
): number {
  if (from === to) return cents;
  return Math.round(from === "USD" ? cents * rate : cents / rate);
}

export type UnitProfit = {
  priceCents: number;
  feeCents: number;
  costCents: number;
  profitCents: number;
  /** Profit as a percent of the price (null when the price is 0). */
  marginPercent: number | null;
};

export function unitProfit(opts: {
  priceCents: number;
  currency: Currency;
  costCents: number;
  costCurrency: Currency;
  feePercent: number;
  rate: number;
}): UnitProfit {
  const fee = gatewayFeeCents(opts.priceCents, opts.feePercent);
  const cost = convertCost(opts.costCents, opts.costCurrency, opts.currency, opts.rate);
  const profit = opts.priceCents - fee - cost;
  return {
    priceCents: opts.priceCents,
    feeCents: fee,
    costCents: cost,
    profitCents: profit,
    marginPercent: opts.priceCents > 0 ? (profit / opts.priceCents) * 100 : null,
  };
}

export function asCurrency(value: string | null | undefined): Currency {
  return value === "LKR" ? "LKR" : "USD";
}

/**
 * Profit of a placed order from the values saved at checkout. `costKnown` is
 * false when any line had no cost price, so the figure is only partial.
 */
export function orderProfit(order: {
  totalCents: number;
  feeCents: number | null;
  items: { unitCostCents: number | null; quantity: number }[];
}) {
  const fee = order.feeCents ?? 0;
  const cost = order.items.reduce((n, i) => n + (i.unitCostCents ?? 0) * i.quantity, 0);
  return {
    feeCents: fee,
    costCents: cost,
    profitCents: order.totalCents - fee - cost,
    costKnown: order.items.every((i) => i.unitCostCents !== null),
  };
}
