import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getPricingSettings, MARGIN_MAX, RATE_MAX, RATE_MIN } from "@/lib/pricing";
import { Card } from "@/components/ui/card";
import { PricingSettingsForm } from "@/components/admin/pricing-settings-form";
import { FEE_MAX_PERCENT } from "@/lib/profit";

export const metadata: Metadata = { title: "Settings · Admin" };

export default async function AdminSettingsPage() {
  const [settings, fixedCount, productCount] = await Promise.all([
    getPricingSettings(),
    prisma.product.count({ where: { priceLkrCents: { not: null } } }),
    prisma.product.count(),
  ]);

  const sourceNote =
    settings.source === "admin"
      ? settings.updatedAt
        ? `Last updated ${settings.updatedAt.toLocaleString()}${settings.updatedBy ? ` by ${settings.updatedBy}` : ""}.`
        : null
      : settings.source === "env"
        ? "Currently using PAYHERE_USD_TO_LKR_RATE from the server settings. Save here to manage it from the admin panel instead."
        : "No rate set yet - using a default of 300. Set today's rate below.";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Store-wide pricing and profit settings.</p>
      </div>

      <Card className="p-6">
        <div className="mb-5">
          <h2 className="font-medium">Exchange rate and fees</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Products are priced in USD. LKR prices are calculated from this rate plus the
            margin, except for the {fixedCount} of {productCount} products with a fixed LKR
            price (set on each product).
          </p>
          {sourceNote && <p className="mt-2 text-xs text-muted-foreground">{sourceNote}</p>}
        </div>
        <PricingSettingsForm
          rate={settings.rate}
          margin={settings.marginPercent}
          rateMin={RATE_MIN}
          rateMax={RATE_MAX}
          marginMax={MARGIN_MAX}
          fee={settings.gatewayFeePercent}
          feeMax={FEE_MAX_PERCENT}
        />
      </Card>
    </div>
  );
}
