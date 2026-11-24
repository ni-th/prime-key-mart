import type { Metadata } from "next";
import { orderLineTotalCents, warrantySummary } from "@/lib/warranty";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { getUserOrderDetail } from "@/lib/orders";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OrderStatusBadge } from "@/components/shop/order-status-badge";
import { OrderKeys } from "@/components/shop/order-keys";
import { InvoiceButton } from "@/components/shop/invoice-button";
import { hasInvoice } from "@/lib/invoice";
import { orderKeysForOwner } from "@/lib/warranty-claims";
import { ReportPaymentIssue } from "@/components/shop/report-payment-issue";
import { canReportPaymentIssue, reportView } from "@/lib/payment-issue";

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
        <div className="flex items-center gap-3">
          {hasInvoice(order) && <InvoiceButton orderNumber={order.orderNumber} />}
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 font-medium">Items</h2>
        <ul className="space-y-2 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                {item.productName}
                {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                {warrantySummary(item) && (
                  <span className="block text-xs">Warranty: {warrantySummary(item)}</span>
                )}
              </span>
              <span className="tabular-nums">
                {formatMoney(orderLineTotalCents(item), order.currency.toUpperCase())}
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
          <OrderKeys token={null} items={await orderKeysForOwner(order.id)} />
        </div>
      ) : (
        <Card className="space-y-4 p-5 text-sm text-muted-foreground">
          <p>
            {order.status === "PENDING"
              ? "We're waiting for the payment confirmation for this order."
              : order.status === "PAID"
                ? "Your payment was received and your keys are being prepared. We'll email them shortly."
                : order.status === "REFUNDED"
                  ? "This order was refunded."
                  : order.status === "FAILED"
                    ? "The payment for this order didn't go through, so no payment was taken."
                  : "We didn't receive a payment for this order, so no keys were delivered."}
          </p>
          {canReportPaymentIssue(order.status) && (
            <ReportPaymentIssue
              orderNumber={order.orderNumber}
              alreadyReported={reportView(order).reported}
              closedMessage={reportView(order).closedMessage}
              canFollowUp={reportView(order).canFollowUp}
            />
          )}
        </Card>
      )}
    </div>
  );
}
