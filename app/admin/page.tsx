import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getAdminOrders, getAdminProducts, getAdminStats, LOW_STOCK_THRESHOLD } from "@/lib/admin";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/shop/order-status-badge";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminDashboardPage() {
  const [stats, products, orders] = await Promise.all([
    getAdminStats(),
    getAdminProducts(),
    getAdminOrders(),
  ]);

  const lowStock = products.filter((p) => p.stock < LOW_STOCK_THRESHOLD);
  const recentOrders = orders.slice(0, 6);

  const perCurrency = (pick: (t: (typeof stats.byCurrency)[number]) => number) =>
    stats.byCurrency.length === 0 ? (
      formatMoney(0, "USD")
    ) : (
      <div className="space-y-0.5">
        {stats.byCurrency.map((t) => (
          <div key={t.currency}>{formatMoney(pick(t), t.currency)}</div>
        ))}
      </div>
    );
  const missingCost = stats.byCurrency.reduce((n, t) => n + t.ordersMissingCost, 0);

  const tiles: { label: string; value: React.ReactNode; note?: string }[] = [
    { label: "Revenue", value: perCurrency((t) => t.revenueCents) },
    {
      label: "Profit (after fees and cost)",
      value: perCurrency((t) => t.profitCents),
      note:
        missingCost > 0
          ? `${missingCost} order${missingCost === 1 ? "" : "s"} had no cost price, so profit is overstated.`
          : undefined,
    },
    { label: "Orders fulfilled", value: stats.fulfilledOrders },
    { label: "Pending", value: stats.pendingOrders },
    { label: "Keys sold", value: stats.keysSold },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {tiles.map((t) => (
          <Card key={t.label} className="p-5">
            <div className="text-2xl font-semibold tabular-nums">{t.value}</div>
            <div className="text-sm text-muted-foreground">{t.label}</div>
            {t.note && (
              <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">{t.note}</div>
            )}
          </Card>
        ))}
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" />
          <h2 className="font-medium">
            Low stock ({"<"} {LOW_STOCK_THRESHOLD} available)
          </h2>
        </div>
        {lowStock.length === 0 ? (
          <Card className="p-5 text-sm text-muted-foreground">
            Every product has healthy stock.
          </Card>
        ) : (
          <div className="divide-y rounded-xl border">
            {lowStock.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 p-3 text-sm"
              >
                <span>{p.name}</span>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "tabular-nums",
                      p.stock === 0
                        ? "text-destructive"
                        : "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {p.stock} left
                  </span>
                  <Link
                    href={`/admin/products/${p.id}/keys`}
                    className={cn(buttonVariants({ size: "xs", variant: "outline" }))}
                  >
                    Add keys
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Recent orders</h2>
          <Link
            href="/admin/orders"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            All orders
          </Link>
        </div>
        <div className="divide-y rounded-xl border">
          {recentOrders.map((o) => (
            <Link
              key={o.id}
              href={`/admin/orders/${o.orderNumber}`}
              className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-muted/40"
            >
              <div className="min-w-0">
                <div className="font-medium">{o.orderNumber}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {o.email} · {o.createdAt.toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <OrderStatusBadge status={o.status} />
                <span className="tabular-nums">{formatMoney(o.totalCents, o.currency.toUpperCase())}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
