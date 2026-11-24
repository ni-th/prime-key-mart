"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart, type CartLine } from "@/lib/cart-store";
import { useHydrated } from "@/lib/use-hydrated";

type Props = {
  product: Omit<CartLine, "quantity">;
  quantity?: number;
  /** Keys in stock. The cart never holds more than this; omitted = no cap. */
  stock?: number;
  disabled?: boolean;
  size?: React.ComponentProps<typeof Button>["size"];
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
  label?: string;
};

export function AddToCartButton({
  product,
  quantity = 1,
  stock,
  disabled,
  size = "default",
  variant = "default",
  className,
  label = "Add to cart",
}: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const add = useCart((s) => s.add);
  const inCart = useCart((s) => s.lines.find((l) => l.productId === product.productId)?.quantity ?? 0);
  const [justAdded, setJustAdded] = useState(false);

  const outOfStock = disabled || stock === 0;
  // The saved cart only exists in the browser: don't judge it before hydration.
  const allInCart = hydrated && stock !== undefined && stock > 0 && inCart >= stock;

  function handleAdd() {
    const room = stock === undefined ? quantity : Math.max(0, stock - inCart);
    if (room <= 0) {
      // Say so right here, rather than letting the customer find out in the cart.
      toast.error(
        `Only ${stock} ${product.name} in stock, and ${stock === 1 ? "it's" : "they're all"} already in your cart.`,
        { action: { label: "View cart", onClick: () => router.push("/cart") } },
      );
      return;
    }
    const adding = Math.min(quantity, room);
    add(product, adding, stock);
    setJustAdded(true);
    toast.success(
      adding < quantity
        ? `Only ${stock} in stock: your cart now has all of them.`
        : `${product.name} added to cart`,
      { action: { label: "View cart", onClick: () => router.push("/cart") } },
    );
    setTimeout(() => setJustAdded(false), 1500);
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      // At the stock limit there's nothing more to add.
      disabled={outOfStock || allInCart}
      title={allInCart ? `All ${stock} in stock are already in your cart` : undefined}
      onClick={handleAdd}
    >
      {justAdded ? <Check className="size-4" /> : <ShoppingCart className="size-4" />}
      {/* All of the stock in this cart = none left for this shopper to add. */}
      {outOfStock || allInCart ? "Out of stock" : justAdded ? "Added" : label}
    </Button>
  );
}
