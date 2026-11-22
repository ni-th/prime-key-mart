import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { canViewOrder, getOrderByNumber } from "@/lib/orders";
import { OrderStatusView } from "@/components/shop/order-status-view";

export const metadata: Metadata = {
  title: "Your order",
  // Private, signed links: keep them out of search engines.
  robots: { index: false, follow: false },
};

/**
 * An order opened from the private link in an email (Find my order, keys
 * email). The signed token in the link is the proof of ownership.
 */
export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; t?: string }>;
}) {
  const { order: orderNumber, t: token } = await searchParams;
  if (!orderNumber) notFound();

  const order = await getOrderByNumber(orderNumber);
  const session = await auth();
  // Same response for "no such order" and "bad link": don't confirm which exist.
  if (!order || !canViewOrder(order, { session, token: token ?? null, orderNumber })) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Order {order.orderNumber}</h1>
      <OrderStatusView orderNumber={order.orderNumber} token={token ?? null} canView />
    </div>
  );
}
