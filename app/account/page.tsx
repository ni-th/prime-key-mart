import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserOrders } from "@/lib/orders";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/shop/order-status-badge";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountOverviewPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [orders, keysOwned] = await Promise.all([
    getUserOrders(userId),
    prisma.licenseKey.count({
      where: { status: "SOLD", orderItem: { order: { userId } } },
    }),
  ]);

  const delivered = orders.filter((o) => o.status === "FULFILLED").length;
  const recent = orders.slice(0, 3);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hi{session!.user.name ? `, ${session!.user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">{session!.user.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-2xl font-semibold">{orders.length}</div>
          <div className="text-sm text-muted-foreground">Orders</div>
        </Card>
        <Card className="p-5">
          <div className="text-2xl font-semibold">{delivered}</div>
          <div className="text-sm text-muted-foreground">Delivered</div>
        </Card>
        <Card className="p-5">
          <div className="text-2xl font-semibold">{keysOwned}</div>
          <div className="text-sm text-muted-foreground">License keys</div>
        </Card>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Recent orders</h2>
          <Link
            href="/account/orders"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            View all
          </Link>
        </div>

        {recent.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            You haven&rsquo;t placed any orders yet.
            <div>
              <Link
                href="/products"
                className={cn(buttonVariants({ size: "sm" }), "mt-4")}
              >
                Browse products
              </Link>
            </div>
          </Card>
        ) : (
          <div className="divide-y rounded-xl border">
            {recent.map((o) => (
              <Link
                key={o.id}
                href={`/account/orders/${o.orderNumber}`}
                className="flex items-center justify-between gap-3 p-4 hover:bg-muted/40"
              >
                <div>
                  <div className="font-medium">{o.orderNumber}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.createdAt.toLocaleDateString()} ·{" "}
                    {o.items.reduce((n, i) => n + i.quantity, 0)} key(s)
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <OrderStatusBadge status={o.status} />
                  <span className="tabular-nums">{formatMoney(o.totalCents, o.currency.toUpperCase())}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
