import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { canViewOrder, getOrderByNumber } from "@/lib/orders";
import { OrderStatusView } from "@/components/shop/order-status-view";
import { ForgetPendingCheckout } from "@/components/shop/pending-checkout";

export const metadata: Metadata = { title: "Order confirmation" };

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; t?: string }>;
}) {
  const { order: orderNumber, t: token } = await searchParams;
  if (!orderNumber) notFound();

  const order = await getOrderByNumber(orderNumber);
  if (!order) notFound();

  const session = await auth();
  const canView = canViewOrder(order, {
    session,
    token: token ?? null,
    orderNumber,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <ForgetPendingCheckout />
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        Thanks for your order
      </h1>
      <OrderStatusView
        orderNumber={orderNumber}
        token={token ?? null}
        canView={canView}
      />
    </div>
  );
}
