import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { getUserOrders } from "@/lib/orders";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/shop/order-status-badge";
import { InvoiceButton } from "@/components/shop/invoice-button";
import { hasInvoice } from "@/lib/invoice";

export const metadata: Metadata = { title: "Your orders" };

export default async function AccountOrdersPage() {
  const session = await auth();
  const orders = await getUserOrders(session!.user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>

      {orders.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No orders yet.
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
          {orders.map((o) => (
            <div key={o.id} className="flex items-center hover:bg-muted/40">
            <Link
              href={`/account/orders/${o.orderNumber}`}
              className="flex min-w-0 flex-1 items-center justify-between gap-4 p-4"
            >
              <div className="min-w-0">
                <div className="font-medium">{o.orderNumber}</div>
                <div className="text-xs text-muted-foreground">
                  {o.createdAt.toLocaleString()} ·{" "}
                  {o.items.reduce((n, i) => n + i.quantity, 0)} key(s) ·{" "}
                  {formatMoney(o.totalCents, o.currency.toUpperCase())}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <OrderStatusBadge status={o.status} />
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </Link>
            {hasInvoice(o) && (
              <InvoiceButton
                orderNumber={o.orderNumber}
                variant="ghost"
                label="Invoice"
                className="mr-3 shrink-0"
              />
            )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
