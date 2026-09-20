import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { decryptOrderKeys, getOrderByNumber } from "@/lib/orders";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OrderStatusBadge } from "@/components/shop/order-status-badge";
import { KeyList } from "@/components/shop/key-list";
import { OrderActions } from "@/components/admin/order-actions";

export const metadata: Metadata = { title: "Order · Admin" };

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const order = await getOrderByNumber(orderNumber);
  if (!order) notFound();

  const keyGroups = ["FULFILLED", "REFUNDED"].includes(order.status)
    ? decryptOrderKeys(order).map((g) => ({
        productName: g.productName,
        keys: g.keys,
      }))
    : [];

  return (
    <div className="space-y-6">
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {order.orderNumber}
          </h1>
          <p className="text-sm text-muted-foreground">
            {order.email}
            {order.userId ? " · registered customer" : " · guest"}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3 text-sm">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Placed</div>
          <div>{order.createdAt.toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Paid</div>
          <div>{order.paidAt ? order.paidAt.toLocaleString() : "—"}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Payment ref</div>
          <div className="truncate">{order.stripePaymentIntentId ?? "—"}</div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 font-medium">Items</h2>
        <ul className="space-y-2 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                {item.productName}
                {item.quantity > 1 ? ` × ${item.quantity}` : ""}
              </span>
              <span className="tabular-nums">
                {formatMoney(item.unitPriceCents * item.quantity, order.currency.toUpperCase())}
              </span>
            </li>
          ))}
        </ul>
        <Separator className="my-3" />
        <div className="flex justify-between font-medium">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(order.totalCents, order.currency.toUpperCase())}</span>
        </div>
      </Card>

      {keyGroups.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium">Delivered keys</h2>
          <KeyList groups={keyGroups} />
        </div>
      )}

      <Card className="p-5">
        <h2 className="mb-3 font-medium">Actions</h2>
        <OrderActions orderNumber={order.orderNumber} status={order.status} />
      </Card>
    </div>
  );
}
