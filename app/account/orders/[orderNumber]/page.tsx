import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { decryptOrderKeys, getUserOrderDetail } from "@/lib/orders";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OrderStatusBadge } from "@/components/shop/order-status-badge";
import { KeyList } from "@/components/shop/key-list";

export const metadata: Metadata = { title: "Order detail" };

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const session = await auth();
  const order = await getUserOrderDetail(session!.user.id, orderNumber);
  if (!order) notFound();

  const keyGroups =
    order.status === "FULFILLED"
      ? decryptOrderKeys(order).map((g) => ({
          productName: g.productName,
          keys: g.keys,
        }))
      : [];

  return (
    <div className="space-y-6">
      <Link
        href="/account/orders"
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
            {order.createdAt.toLocaleString()} · {order.email}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
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

      {order.status === "FULFILLED" ? (
        <div className="space-y-3">
          <h2 className="font-medium">Your license keys</h2>
          <KeyList groups={keyGroups} />
        </div>
      ) : (
        <Card className="p-5 text-sm text-muted-foreground">
          {order.status === "PENDING"
            ? "This order is awaiting payment. No keys have been assigned yet."
            : "This order was not completed, so no keys were delivered."}
        </Card>
      )}
    </div>
  );
}
