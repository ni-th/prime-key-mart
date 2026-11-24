import { cache } from "react";
import { prisma } from "@/lib/db";
import { getPricingSettings } from "@/lib/pricing";
import type { PaymentLimits } from "@/lib/payment-limit";

export type PaymentSettings = {
  /** Largest single payment in LKR cents; null = no limit. */
  maxPaymentLkrCents: number | null;
  usdEnabled: boolean;
  /** The limit in each currency (USD converted at the market rate). */
  limits: PaymentLimits;
};

/** Payment limit and currencies, from Admin -> Settings. Cached per request. */
export const getPaymentSettings = cache(async (): Promise<PaymentSettings> => {
  const [row, pricing] = await Promise.all([
    prisma.storeSettings.findUnique({
      where: { id: "default" },
      select: { maxPaymentLkrCents: true, usdPaymentsEnabled: true },
    }),
    getPricingSettings(),
  ]);
  const max = row?.maxPaymentLkrCents ?? null;
  return {
    maxPaymentLkrCents: max,
    usdEnabled: row?.usdPaymentsEnabled ?? true,
    // Rounded down, so a USD order under the limit is under it in LKR too.
    limits: { LKR: max, USD: max === null ? null : Math.floor(max / pricing.rate) },
  };
});
