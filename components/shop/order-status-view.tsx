"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, XCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart-store";
import { KeyList } from "@/components/shop/key-list";

type KeyGroup = { productName: string; quantity: number; keys: string[] };
type StatusResponse = {
  orderNumber: string;
  status: string;
  email: string;
  totalCents: number;
  keys: KeyGroup[] | null;
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

  // Payment confirmed but we ran out of keys — an admin has been alerted.
  // Keep polling (PAID isn't in DONE) so the keys appear once delivered.
  if (data?.status === "PAID") {
    return (
      <Card className="flex items-center gap-3 p-6">
        <Check className="size-5 text-emerald-600 dark:text-emerald-400" />
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
      <Card className="flex items-center gap-3 p-6">
        <Loader2 className="size-5 animate-spin text-primary" />
        <div className="text-sm">
          <p className="font-medium">Payment received</p>
          <p className="text-muted-foreground">Preparing your license keys…</p>
        </div>
      </Card>
    );
  }

  if (data.status === "EXPIRED" || data.status === "FAILED") {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 font-medium">
          <XCircle className="size-5 text-muted-foreground" />
          This order was cancelled
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          No payment was taken and the keys were released.
        </p>
        <Link
          href="/products"
          className={cn(buttonVariants({ size: "sm" }), "mt-4")}
        >
          Back to store
        </Link>
      </Card>
    );
  }

  // FULFILLED (or REFUNDED — still show what was delivered)
  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Check className="size-5 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium">Order {data.orderNumber} complete</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          A copy of these keys has been emailed to {data.email}.
        </p>
      </Card>

      <KeyList
        groups={(data.keys ?? []).map((g) => ({
          productName: g.productName,
          keys: g.keys,
        }))}
      />

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
