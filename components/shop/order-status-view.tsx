"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, XCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart-store";
import { ReportPaymentIssue } from "@/components/shop/report-payment-issue";
import { OrderKeys } from "@/components/shop/order-keys";
import type { OrderKeyItem } from "@/lib/warranty-claim-shared";

/** After this long without a payment confirmation, offer the report form. */
const SLOW_AFTER_MS = 45_000;

type StatusResponse = {
  orderNumber: string;
  status: string;
  email: string;
  totalCents: number;
  reported: boolean;
  closedMessage: string | null;
  canFollowUp: boolean;
  keys: OrderKeyItem[] | null;
};

const DONE = new Set(["FULFILLED", "EXPIRED", "FAILED", "REFUNDED"]);

export function OrderStatusView({
  orderNumber,
  token,
  canView,
}: {
  orderNumber: string;
  token: string | null;
  canView: boolean;
}) {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clearCart = useCart((s) => s.clear);
  const clearedRef = useRef(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  const poll = useCallback(async () => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    try {
      const res = await fetch(`/api/orders/${orderNumber}/status${qs}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError("We couldn't load this order.");
        return true;
      }
      const json = (await res.json()) as StatusResponse;
      setData(json);

      if (json.status === "FULFILLED" && !clearedRef.current) {
        clearedRef.current = true;
        const flag = `keymart-cleared-${orderNumber}`;
        try {
          if (!localStorage.getItem(flag)) {
            clearCart();
            localStorage.setItem(flag, "1");
          }
        } catch {
          clearCart();
        }
      }
      return DONE.has(json.status);
    } catch {
      return false;
    }
  }, [orderNumber, token, clearCart]);

  useEffect(() => {
    if (!canView) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      const done = await poll();
      if (active && !done) timer = setTimeout(tick, 2500);
    };
    tick();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [canView, poll]);

  if (!canView) {
    return (
      <Card className="p-6 text-sm">
        <p className="font-medium">Order {orderNumber} placed</p>
        <p className="mt-1 text-muted-foreground">
          Your license keys have been emailed. Sign in with the same email to
          view them here, or use{" "}
          <Link href="/order-lookup" className="underline">
            order lookup
          </Link>
          .
        </p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">{error}</Card>
    );
  }

  // Payment confirmed but we ran out of keys - an admin has been alerted.
  // Keep polling (PAID isn't in DONE) so the keys appear once delivered.
  if (data?.status === "PAID") {
    return (
      <Card className="flex items-center gap-3 p-6">
        <Check className="size-5 text-success" />
        <div className="text-sm">
          <p className="font-medium">Payment received</p>
          <p className="text-muted-foreground">
            Your keys are being prepared and will be emailed to {data.email}{" "}
            shortly. You can safely close this page.
          </p>
        </div>
      </Card>
    );
  }

  if (!data || data.status === "PENDING") {
    return (
      <Card className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
          <div className="text-sm">
            <p className="font-medium">
              {slow ? "Still waiting for payment confirmation" : "Confirming your payment..."}
            </p>
            <p className="text-muted-foreground">
              {slow
                ? `This is taking longer than usual. If you completed the payment, your keys will be emailed to ${data?.email ?? "you"} as soon as it's confirmed. You can safely close this page.`
                : "This usually takes a few seconds. Please keep this page open."}
            </p>
          </div>
        </div>
        {slow && data && (
          <ReportPaymentIssue
            orderNumber={orderNumber}
            token={token}
            alreadyReported={data.reported}
            closedMessage={data.closedMessage}
            canFollowUp={data.canFollowUp}
          />
        )}
      </Card>
    );
  }

  if (data.status === "REFUNDED") {
    return (
      <Card className="space-y-2 p-6">
        <div className="flex items-center gap-2 font-medium">
          <XCircle className="size-5 text-muted-foreground" />
          This order was refunded
        </div>
        <p className="text-sm text-muted-foreground">
          The payment for order {data.orderNumber} was refunded. Refunds usually reach your
          account within 5-10 working days, depending on your bank.
        </p>
        <Link href="/products" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-2")}>
          Back to store
        </Link>
      </Card>
    );
  }

  if (data.status === "FAILED") {
    return (
      <Card className="space-y-4 p-6">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <XCircle className="size-5 text-muted-foreground" />
            The payment didn&apos;t go through
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            No payment was taken for this order. If you see a pending charge from your bank, it&apos;s
            a temporary hold that will be released. You can try again with a new order.
          </p>
        </div>
        <Link href="/cart" className={cn(buttonVariants({ size: "sm" }))}>
          Back to cart
        </Link>
      </Card>
    );
  }

  if (data.status === "EXPIRED") {
    return (
      <Card className="space-y-4 p-6">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <XCircle className="size-5 text-muted-foreground" />
            We didn&apos;t receive a payment for this order
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            The checkout timed out or the payment didn&apos;t go through. If you weren&apos;t
            charged, there&apos;s nothing more to do. If you were charged, let us know and
            we&apos;ll send your keys.
          </p>
        </div>
        <ReportPaymentIssue
          orderNumber={orderNumber}
          token={token}
          alreadyReported={data.reported}
          closedMessage={data.closedMessage}
          canFollowUp={data.canFollowUp}
        />
        <Link href="/products" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
          Back to store
        </Link>
      </Card>
    );
  }

  // FULFILLED
  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Check className="size-5 text-success" />
          <span className="font-medium">Order {data.orderNumber} complete</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          A copy of these keys has been emailed to {data.email}.
        </p>
      </Card>

      <OrderKeys token={token} items={data.keys ?? []} />

      <div className="flex gap-3">
        <Link
          href="/account/orders"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          View in my orders
        </Link>
        <Link
          href="/products"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
