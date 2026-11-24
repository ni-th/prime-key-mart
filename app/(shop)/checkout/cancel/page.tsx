import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { canViewOrder, getOrderByNumber } from "@/lib/orders";
import { releaseOrderReservation } from "@/lib/inventory";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ForgetPendingCheckout } from "@/components/shop/pending-checkout";

export const metadata: Metadata = { title: "Payment cancelled" };

export default async function CheckoutCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; t?: string }>;
}) {
  const { order: orderNumber, t: token } = await searchParams;

  // The customer backed out on PayHere: hand their keys back to stock now
  // rather than waiting for the reservation to expire. Requires the signed
  // order token (or the owner's session) so nobody can cancel someone else's
  // checkout by guessing an order number. Only PENDING orders are affected.
  if (orderNumber) {
    const order = await getOrderByNumber(orderNumber);
    if (order) {
      const session = await auth();
      if (canViewOrder(order, { session, token: token ?? null, orderNumber })) {
        await releaseOrderReservation(order.id, "EXPIRED");
      }
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <ForgetPendingCheckout />
      <Card className="p-8">
        <h1 className="text-lg font-semibold">Payment cancelled</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No charge was made and your reserved keys have been released back to
          stock. Your cart is still saved.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/cart" className={cn(buttonVariants({ size: "sm" }))}>
            Return to cart
          </Link>
          <Link
            href="/products"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Keep browsing
          </Link>
        </div>
      </Card>
    </div>
  );
}
