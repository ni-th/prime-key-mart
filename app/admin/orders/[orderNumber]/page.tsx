import type { Metadata } from "next";
import { orderLineTotalCents, warrantySummary } from "@/lib/warranty";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircleWarning } from "lucide-react";
import { decryptOrderKeys, getOrderByNumber } from "@/lib/orders";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OrderStatusBadge } from "@/components/shop/order-status-badge";
import { KeyList } from "@/components/shop/key-list";
import { OrderActions } from "@/components/admin/order-actions";
import { getOrderProfit } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { CLAIM_REASONS, CLAIM_STATUS, type ClaimReason, type ClaimStatus } from "@/lib/warranty-claim-shared";
import { RESOLVED_DELIVERED } from "@/lib/payment-issue";

export const metadata: Metadata = { title: "Order · Admin" };

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const order = await getOrderByNumber(orderNumber);
  if (!order) notFound();

  const [profit, claims] = await Promise.all([
    getOrderProfit(order.id),
    prisma.warrantyClaim.findMany({
      where: { orderItem: { orderId: order.id } },
      orderBy: { createdAt: "desc" },
      include: { orderItem: { select: { productName: true } } },
    }),
  ]);
  const cur = order.currency.toUpperCase();

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
          {order.customerName && (
            <p className="text-sm text-muted-foreground">
              {order.customerName}
              {order.customerPhone && (
                <>
                  {" · "}
                  <a href={`tel:${order.customerPhone.replace(/[^\d+]/g, "")}`} className="hover:underline">
                    {order.customerPhone}
                  </a>
                </>
              )}
              {order.customerCountry && ` · ${order.customerCountry}`}
            </p>
          )}
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {order.issueReportedAt && (
        <Card
          className={
            order.issueResolvedAt
              ? "p-5 text-sm"
              : "border-amber-500/50 bg-amber-500/5 p-5 text-sm"
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-medium">
              <MessageCircleWarning className="size-4 text-amber-600 dark:text-amber-400" />
              Customer says they paid
            </h2>
            <span className="text-xs text-muted-foreground">
              Reported {order.issueReportedAt.toLocaleString()}
            </span>
          </div>
          <dl className="mt-3 grid gap-1.5 sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">Payment reference</dt>
            <dd className="font-mono">{order.issuePaymentRef ?? "Not given"}</dd>
            <dt className="text-muted-foreground">Message</dt>
            <dd className="whitespace-pre-line">{order.issueNote ?? "None"}</dd>
            <dt className="text-muted-foreground">Reply to</dt>
            <dd>
              <a href={`mailto:${order.email}?subject=Your Keysby order ${order.orderNumber}`} className="underline">
                {order.email}
              </a>
            </dd>
          </dl>
          {order.issueResolvedAt ? (
            order.issueResolution === RESOLVED_DELIVERED ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Handled {order.issueResolvedAt.toLocaleString()}: keys delivered.
              </p>
            ) : (
              <div className="mt-3 rounded-md border bg-muted/40 p-3 text-xs">
                <div className="font-medium">
                  Closed as not paid {order.issueResolvedAt.toLocaleString()}. Sent to the customer:
                </div>
                <p className="mt-1 whitespace-pre-line text-muted-foreground">{order.issueResolution}</p>
              </div>
            )
          ) : (
            <ol className="mt-3 list-decimal space-y-0.5 pl-5 text-xs text-muted-foreground">
              <li>Find order {order.orderNumber} in your PayHere merchant dashboard.</li>
              <li>If it was paid in full, use &quot;Mark as paid &amp; deliver keys&quot; below.</li>
              <li>If not, use &quot;Not paid - close report&quot; and email the customer.</li>
            </ol>
          )}
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3 text-sm">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Placed</div>
          <div>{order.createdAt.toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Paid</div>
          <div>{order.paidAt ? order.paidAt.toLocaleString() : "-"}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Payment ref</div>
          <div className="truncate">{order.stripePaymentIntentId ?? "-"}</div>
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
                {warrantySummary(item) && (
                  <span className="block text-xs">Warranty: {warrantySummary(item)}</span>
                )}
                {item.discountPercent !== null && (
                  <span className="ml-1.5 text-xs font-medium text-destructive">
                    {item.discountName} -{item.discountPercent}%
                  </span>
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

      {profit && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-medium">Profit</h2>
            <span className="text-xs text-muted-foreground">Admin only · saved at checkout</span>
          </div>
          <div className="space-y-1.5 text-sm tabular-nums">
            <div className="flex justify-between gap-3 text-muted-foreground">
              <span>Customer paid</span>
              <span>{formatMoney(order.totalCents, cur)}</span>
            </div>
            <div className="flex justify-between gap-3 text-muted-foreground">
              <span>Gateway fee</span>
              <span>-{formatMoney(profit.feeCents, cur)}</span>
            </div>
            <div className="flex justify-between gap-3 text-muted-foreground">
              <span>Cost of keys</span>
              <span>-{formatMoney(profit.costCents, cur)}</span>
            </div>
            <Separator className="my-2" />
            <div
              className={
                profit.profitCents < 0
                  ? "flex justify-between gap-3 font-medium text-destructive"
                  : "flex justify-between gap-3 font-medium text-emerald-600 dark:text-emerald-400"
              }
            >
              <span>{profit.profitCents < 0 ? "Loss" : "Profit"}</span>
              <span>{formatMoney(profit.profitCents, cur)}</span>
            </div>
          </div>
          {!profit.costKnown && (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
              Some items had no cost price when this order was placed, so the real profit is lower.
            </p>
          )}
          {order.status !== "FULFILLED" && (
            <p className="mt-3 text-xs text-muted-foreground">
              Only fulfilled orders count towards the dashboard profit.
            </p>
          )}
        </Card>
      )}

      {order.status === "REFUNDED" && (
        <Card className="border-destructive/30 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Refund</h2>
            <span className="text-xs text-muted-foreground">
              {order.refundedAt ? order.refundedAt.toLocaleString() : ""}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
            {order.refundNote || "No note was added."}
          </p>
        </Card>
      )}

      {claims.length > 0 && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-medium">Warranty claims</h2>
            <Link href="/admin/warranty/claims?status=ALL" className="text-xs text-muted-foreground hover:underline">
              All claims
            </Link>
          </div>
          <ul className="space-y-2 text-sm">
            {claims.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {c.orderItem.productName}{" "}
                  <span className="text-muted-foreground">
                    · {CLAIM_REASONS[c.reason as ClaimReason] ?? c.reason} · {c.createdAt.toLocaleDateString()}
                  </span>
                </span>
                <Link
                  href={c.status === "OPEN" ? "/admin/warranty/claims" : "/admin/warranty/claims?status=ALL"}
                  className="text-xs font-medium hover:underline"
                >
                  {CLAIM_STATUS[c.status as ClaimStatus] ?? c.status}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {keyGroups.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium">Delivered keys</h2>
          <KeyList groups={keyGroups} />
        </div>
      )}

      <Card className="p-5">
        <h2 className="mb-3 font-medium">Actions</h2>
        <OrderActions
          orderNumber={order.orderNumber}
          status={order.status}
          openReport={Boolean(order.issueReportedAt && !order.issueResolvedAt)}
          customerEmail={order.email}
        />
      </Card>
    </div>
  );
}
