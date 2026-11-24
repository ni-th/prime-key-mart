"use client";

import { useCart } from "@/lib/cart-store";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

/**
 * "In stock" / "Out of stock" on product cards. Counts this shopper's cart:
 * once every key in stock is in their cart, there's none left for them to add.
 */
export function StockLabel({ productId, stock }: { productId: string; stock: number }) {
  const hydrated = useHydrated();
  const inCart = useCart((s) => s.lines.find((l) => l.productId === productId)?.quantity ?? 0);
  const allInCart = hydrated && stock > 0 && inCart >= stock;

  if (stock <= 0) return <span className="text-xs text-muted-foreground">Out of stock</span>;
  return (
    <span className={cn("text-xs", allInCart ? "text-destructive" : "text-success")}>
      {allInCart ? "Out of stock (all in your cart)" : "In stock"}
    </span>
  );
}
