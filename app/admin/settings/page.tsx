import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getPricingSettings, MARGIN_MAX, RATE_MAX, RATE_MIN } from "@/lib/pricing";
import { Card } from "@/components/ui/card";
import { PricingSettingsForm } from "@/components/admin/pricing-settings-form";
import { FEE_MAX_PERCENT } from "@/lib/profit";
import { ALERT_TYPES, getAlertSettings, type AlertType } from "@/lib/alerts";
import { AlertSettingsForm } from "@/components/admin/alert-settings-form";
import { PaymentSettingsForm } from "@/components/admin/payment-settings-form";
import { Badge } from "@/components/ui/badge";

const logTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Colombo",
});

export const metadata: Metadata = { title: "Settings · Admin" };

export default async function AdminSettingsPage() {
  const [settings, fixedCount, productCount, row, alerts, log] = await Promise.all([
    getPricingSettings(),
    prisma.product.count({ where: { priceLkrCents: { not: null } } }),
    prisma.product.count(),
    prisma.storeSettings.findUnique({ where: { id: "default" } }),
    getAlertSettings(),
    prisma.alertLog.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
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
        <p className="mt-1 text-sm text-muted-foreground">Store-wide pricing, profit and alert settings.</p>
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

      <Card className="p-6">
        <div className="mb-5">
          <h2 className="font-medium">Payments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What customers can pay with, and the largest payment PayHere will accept.
          </p>
        </div>
        <PaymentSettingsForm
          maxPaymentLkr={row?.maxPaymentLkrCents == null ? null : row.maxPaymentLkrCents / 100}
          usdEnabled={row?.usdPaymentsEnabled ?? true}
          rate={settings.rate}
        />
      </Card>

      <Card className="p-6">
        <div className="mb-5">
          <h2 className="font-medium">Email alerts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Get an email when something needs your attention. Alerts never slow down or block a
            customer&apos;s checkout.
          </p>
        </div>
        <AlertSettingsForm
          alertEmails={row?.alertEmails ?? ""}
          fallbackEmail={process.env.ADMIN_EMAIL || process.env.SMTP_USER || null}
          lowStockThreshold={alerts.lowStockThreshold}
          toggles={{
            alertLowStock: alerts.enabled.LOW_STOCK,
            alertOutOfStock: alerts.enabled.OUT_OF_STOCK,
            alertFailedDelivery: alerts.enabled.FAILED_DELIVERY,
            alertPaymentProblem: alerts.enabled.PAYMENT_PROBLEM,
            alertNewOrder: alerts.enabled.NEW_ORDER,
          }}
        />
      </Card>

      <Card className="p-6">
        <div className="mb-4">
          <h2 className="font-medium">Recent alerts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The last 25 alerts, including ones that failed to send or were skipped as repeats.
            Times are Sri Lanka time.
          </p>
        </div>
        {log.length === 0 ? (
          <p className="text-sm text-muted-foreground">No alerts yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {log.map((a) => (
              <li key={a.id} className="space-y-1 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={a.status === "SENT" ? "secondary" : a.status === "FAILED" ? "destructive" : "outline"}
                  >
                    {a.status === "SENT" ? "Sent" : a.status === "FAILED" ? "Failed" : "Skipped (repeat)"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {ALERT_TYPES[a.type as AlertType] ?? a.type} · {logTime.format(a.createdAt)}
                  </span>
                </div>
                <div className="font-medium">{a.subject}</div>
                <div className="text-xs text-muted-foreground">
                  To {a.recipients || "nobody"}
                  {a.error ? ` · ${a.error}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
