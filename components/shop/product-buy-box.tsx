"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart, type CartLine } from "@/lib/cart-store";
import { AddToCartButton } from "@/components/shop/add-to-cart-button";
import { WarrantyPicker } from "@/components/shop/warranty-picker";
import { formatMoney } from "@/lib/money";
import { resolveWarranty, type PricedWarranty } from "@/lib/warranty";

export function ProductBuyBox({
  product,
  stock,
  warranties = [],
  unitLkrCents,
}: {
  product: Omit<CartLine, "quantity" | "warrantyPlanId">;
  stock: number;
  /** Priced warranty plans this product offers. */
  warranties?: PricedWarranty[];
  /** Product price in LKR (after any sale), for the total line. */
  unitLkrCents: number;
}) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  // Start on the included plan (or the first offered).
  const [planId, setPlanId] = useState<string | null>(resolveWarranty(warranties)?.planId ?? null);
  const max = Math.min(stock, 10);
  const inStock = stock > 0;

  const chosen = warranties.find((w) => w.planId === planId) ?? null;
  const line = { ...product, warrantyPlanId: planId };
  const totalUsd = (product.priceCents + (chosen?.usdCents ?? 0)) * qty;
  const totalLkr = (unitLkrCents + (chosen?.lkrCents ?? 0)) * qty;

  function buyNow() {
    add(line, qty);
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
              disabled={qty <= 1}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
            >
              <Minus className="size-3.5" />
            </Button>
            <span className="w-8 text-center text-sm tabular-nums">{qty}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={qty >= max}
              onClick={() => setQty((q) => Math.min(max, q + 1))}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">{stock} available</span>
        </div>
      )}

      {inStock && (chosen?.usdCents || qty > 1) ? (
        <div className="text-sm">
          <span className="text-muted-foreground">Total: </span>
          <span className="font-semibold tabular-nums">{formatMoney(totalUsd, "USD")}</span>
          <span className="ml-2 text-muted-foreground tabular-nums">{formatMoney(totalLkr, "LKR")}</span>
          {chosen && chosen.usdCents > 0 && (
            <span className="text-muted-foreground"> (incl. {chosen.name} warranty)</span>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <AddToCartButton
          product={line}
          quantity={qty}
          disabled={!inStock}
          size="lg"
          variant="outline"
        />
        <Button type="button" size="lg" disabled={!inStock} onClick={buyNow}>
          Buy now
        </Button>
      </div>
    </div>
  );
}
