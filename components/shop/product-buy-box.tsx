"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Minus, PhoneCall, Plus, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart, type CartLine } from "@/lib/cart-store";
import { AddToCartButton } from "@/components/shop/add-to-cart-button";
import { WarrantyPicker } from "@/components/shop/warranty-picker";
import { BackInStockForm } from "@/components/shop/back-in-stock-form";
import { useHydrated } from "@/lib/use-hydrated";
import { formatMoney } from "@/lib/money";
import { resolveWarranty, type PricedWarranty } from "@/lib/warranty";
import { checkPeriod } from "@/lib/warranty-claim-shared";
import { ACTIVATION_REPLY_TIME, type DeliveryType } from "@/lib/delivery";

export function ProductBuyBox({
  product,
  stock,
  warranties = [],
  unitLkrCents,
  freeCheckHours = 0,
  deliveryType = "KEY",
}: {
  product: Omit<CartLine, "quantity" | "warrantyPlanId">;
  stock: number;
  /** Priced warranty plans this product offers. */
  warranties?: PricedWarranty[];
  /** Product price in LKR (after any sale), for the total line. */
  unitLkrCents: number;
  /** Store-wide period after delivery in which any key can be reported. */
  freeCheckHours?: number;
  deliveryType?: DeliveryType;
}) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const hydrated = useHydrated();
  const storedInCart = useCart((s) => s.lines.find((l) => l.productId === product.productId)?.quantity ?? 0);
  const inCart = hydrated ? storedInCart : 0;
  const [qty, setQty] = useState(1);
  // Start on the included plan (or the first offered).
  const [planId, setPlanId] = useState<string | null>(resolveWarranty(warranties)?.planId ?? null);
  // Only what's left after what's already in the cart can be added.
  const left = Math.max(0, stock - inCart);
  const max = Math.max(1, Math.min(left, 10));
  const inStock = stock > 0;
  const shownQty = Math.min(qty, max);

  const chosen = warranties.find((w) => w.planId === planId) ?? null;
  const line = { ...product, warrantyPlanId: planId };
  const totalUsd = (product.priceCents + (chosen?.usdCents ?? 0)) * shownQty;
  const totalLkr = (unitLkrCents + (chosen?.lkrCents ?? 0)) * shownQty;

  function buyNow() {
    // Everything in stock already in the cart: just go and pay for it.
    if (left > 0) add(line, shownQty, stock);
    router.push("/cart");
  }

  return (
    <div className="space-y-4">
      {inStock && warranties.length > 0 && (
        <WarrantyPicker options={warranties} value={planId} onChange={setPlanId} />
      )}

      {inStock && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Quantity</span>
          <div className="flex items-center rounded-lg border">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={shownQty <= 1}
              onClick={() => setQty(Math.max(1, shownQty - 1))}
            >
              <Minus className="size-3.5" />
            </Button>
            <span className="w-8 text-center text-sm tabular-nums">{shownQty}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={shownQty >= max}
              onClick={() => setQty(Math.min(max, shownQty + 1))}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
          <span className={inCart > 0 && left === 0 ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>
            {inCart === 0
              ? `${stock} available`
              : left === 0
                ? `All ${stock} in stock are in your cart`
                : `${left} more available (${inCart} in your cart)`}
          </span>
        </div>
      )}

      {inStock && (chosen?.usdCents || shownQty > 1) ? (
        <div className="text-sm">
          <span className="text-muted-foreground">Total: </span>
          <span className="font-semibold tabular-nums">{formatMoney(totalUsd, "USD")}</span>
          <span className="ml-2 text-muted-foreground tabular-nums">{formatMoney(totalLkr, "LKR")}</span>
          {chosen && chosen.usdCents > 0 && (
            <span className="text-muted-foreground"> (incl. {chosen.name} warranty)</span>
          )}
        </div>
      ) : null}

      {inStock ? (
        <div className="flex flex-wrap gap-3">
          <AddToCartButton product={line} quantity={shownQty} stock={stock} size="lg" variant="outline" />
          <Button type="button" size="lg" onClick={buyNow}>
            Buy now
          </Button>
        </div>
      ) : (
        <BackInStockForm productId={product.productId} />
      )}

      {deliveryType === "ACCOUNT" && (
        <p className="flex gap-2 text-xs text-muted-foreground">
          <UserRound className="mt-px size-3.5 shrink-0" />
          <span>
            Delivered as an account: you get a username and password. You may change the password, but
            keep it safe: we can&apos;t recover a forgotten one.
          </span>
        </p>
      )}
      {deliveryType === "PHONE" && (
        <p className="flex gap-2 text-xs text-muted-foreground">
          <PhoneCall className="mt-px size-3.5 shrink-0" />
          <span>
            Phone activation: after entering the key, send us the Installation ID from your order page and
            we&apos;ll reply with the Confirmation ID, {ACTIVATION_REPLY_TIME}.
          </span>
        </p>
      )}
      {freeCheckHours > 0 && (
        <p className="flex gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-px size-3.5 shrink-0 text-success" />
          <span>
            {deliveryType === "ACCOUNT" ? "Account not working?" : "Key not working?"} Report it within{" "}
            {checkPeriod(freeCheckHours)} of {deliveryType === "PHONE" ? "getting your Confirmation ID" : "delivery"}{" "}
            for a replacement or refund.{warranties.length > 0 ? " Add a warranty for longer cover." : ""}
          </span>
        </p>
      )}
    </div>
  );
}
