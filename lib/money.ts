const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat(currency === "LKR" ? "en-LK" : "en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/** Format an integer cent amount as USD, e.g. 2999 -> "$29.99". */
export function formatUsd(cents: number): string {
  return usdFormatter.format(cents / 100);
}

/** Sum line items given as { unitPriceCents, quantity }. */
export function sumCents(
  items: { unitPriceCents: number; quantity: number }[],
): number {
  return items.reduce((total, i) => total + i.unitPriceCents * i.quantity, 0);
}
