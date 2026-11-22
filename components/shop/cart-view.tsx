"use client";

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatMoney, formatUsd } from "@/lib/money";
import { useCartQuote } from "@/lib/use-cart-quote";
import type { CartQuoteLine } from "@/app/actions/pricing";
import {
  selectCartSubtotal,
  useCart,
  type CartLine,
} from "@/lib/cart-store";
import { useHydrated } from "@/lib/use-hydrated";
import { ProductThumb } from "@/components/shop/product-thumb";

const MAX_PER_LINE = 10;

function CartRow({ line, quoted }: { line: CartLine; quoted?: CartQuoteLine }) {
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  // Live USD price from the server; the price saved when added is a fallback.
  const unit = quoted?.available ? quoted.usdCents : line.priceCents;
  const onSale = Boolean(quoted?.available && quoted.salePercent);

  return (
    <div className="flex gap-4 py-4">
      <Link
        href={`/products/${line.slug}`}
        className="relative aspect-square h-20 w-20 shrink-0 overflow-hidden rounded-lg border"
      >
        <ProductThumb name={line.name} brand={line.brand} />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/products/${line.slug}`}
            className="font-medium hover:underline"
          >
            {line.name}
          </Link>
          <span className="shrink-0 text-right font-medium tabular-nums">
            <span className={onSale ? "text-destructive" : undefined}>
              {formatUsd(unit * line.quantity)}
            </span>
            {onSale && (
              <s className="block text-xs font-normal text-muted-foreground">
                {formatUsd(quoted!.listUsdCents * line.quantity)}
              </s>
            )}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {line.brand} · {formatUsd(unit)} each
          {onSale && (
            <span className="ml-1.5 font-medium text-destructive">-{quoted!.salePercent}% sale</span>
          )}
        </span>

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center rounded-lg border">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Decrease quantity"
              onClick={() => setQty(line.productId, line.quantity - 1)}
            >
              <Minus className="size-3.5" />
            </Button>
            <span className="w-8 text-center text-sm tabular-nums">
              {line.quantity}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Increase quantity"
              disabled={line.quantity >= MAX_PER_LINE}
              onClick={() => setQty(line.productId, line.quantity + 1)}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => remove(line.productId)}
          >
            <Trash2 className="size-3.5" />
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CartView() {
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
  const snapshotSubtotal = useCart(selectCartSubtotal);
  // Live prices from the server; the stored snapshot is only a placeholder.
  const { quote, byId } = useCartQuote(lines);
  const usdTotal = quote?.totals.USD ?? snapshotSubtotal;
  const lkrTotal = quote?.totals.LKR ?? null;
  const usdSavings = quote
    ? quote.lines.reduce((n, l) => n + (l.listUsdCents - l.usdCents) * l.quantity, 0)
    : 0;

  if (!hydrated) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        <Link
          href="/products"
          className={cn(buttonVariants({ size: "sm" }), "mt-4")}
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="divide-y">
        {lines.map((line) => (
          <CartRow key={line.productId} line={line} quoted={byId.get(line.productId)} />
        ))}
        <div className="flex justify-end pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={clear}
          >
            Clear cart
          </Button>
        </div>
      </div>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card className="p-5">
          <h2 className="font-medium">Order summary</h2>
          {usdSavings > 0 && (
            <div className="mt-4 flex justify-between text-sm text-destructive">
              <span>Sale savings</span>
              <span className="tabular-nums">-{formatUsd(usdSavings)}</span>
            </div>
          )}
          <div className={cn("flex justify-between font-medium", usdSavings > 0 ? "mt-2" : "mt-4")}>
            <span>Total</span>
            <span className="tabular-nums">{formatUsd(usdTotal)}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-muted-foreground">In Sri Lankan rupees</span>
            <span className="tabular-nums text-muted-foreground">
              {lkrTotal === null ? (
                <Skeleton className="inline-block h-4 w-20 align-middle" />
              ) : (
                formatMoney(lkrTotal, "LKR")
              )}
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Choose LKR or USD at checkout. No extra fees or taxes are added.
          </p>
          <Separator className="my-4" />
          <Link
            href="/checkout"
            className={cn(buttonVariants({ size: "lg" }), "mt-4 w-full")}
          >
            Proceed to checkout
          </Link>
          <Link
            href="/products"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "mt-2 w-full",
            )}
          >
            Continue shopping
          </Link>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Keys are emailed instantly after payment.
          </p>
        </Card>
      </div>
    </div>
  );
}
