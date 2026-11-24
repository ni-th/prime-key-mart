import type { Metadata } from "next";
import { CartView } from "@/components/shop/cart-view";
import { ReleaseAbandonedCheckout } from "@/components/shop/pending-checkout";

export const metadata: Metadata = {
  title: "Your cart",
};

export default function CartPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Your cart</h1>
      <CartView />
      <ReleaseAbandonedCheckout />
    </div>
  );
}
