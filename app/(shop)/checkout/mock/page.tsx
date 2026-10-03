import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { auth } from "@/lib/auth";
import { isPayHereConfigured } from "@/lib/payhere";
import { canViewOrder, getOrderByNumber } from "@/lib/orders";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MockPayment } from "@/components/shop/mock-payment";

export const metadata: Metadata = { title: "Test payment" };

export default async function MockCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; t?: string }>;
}) {
  if (isPayHereConfigured) notFound();

  const { order: orderNumber, t: token } = await searchParams;
  if (!orderNumber || !token) notFound();

  const order = await getOrderByNumber(orderNumber);
  if (!order) notFound();

  const session = await auth();
  if (!canViewOrder(order, { session, token, orderNumber })) notFound();

  if (order.status === "FULFILLED") {
    redirect(`/checkout/success?order=${orderNumber}&t=${token}`);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <FlaskConical className="size-3.5" />
        Simulated payment screen — PayHere is not connected.
      </div>

      <Card className="p-6">
        <h1 className="text-lg font-semibold">Confirm your order</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Order {order.orderNumber} · sent to {order.email}
        </p>

        <ul className="mt-4 space-y-2 text-sm">
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
        <Separator className="my-4" />
        <div className="mb-5 flex justify-between font-medium">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(order.totalCents, order.currency.toUpperCase())}</span>
        </div>

        <MockPayment
          orderNumber={order.orderNumber}
          token={token}
          totalCents={order.totalCents}
          currency={order.currency}
        />
      </Card>
    </div>
  );
}
