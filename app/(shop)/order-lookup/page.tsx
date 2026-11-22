import type { Metadata } from "next";
import { OrderLookup } from "@/components/shop/order-lookup";
import { BUSINESS } from "@/lib/business";

export const metadata: Metadata = {
  title: "Find my order",
  description: "Get your order and license keys emailed to you again.",
};

export default function OrderLookupPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">
        Find my order
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Lost your keys email? Enter your order number (it&apos;s on your PayHere receipt)
        and the email you used at checkout, and we&apos;ll email your order again.
      </p>
      <OrderLookup supportEmail={BUSINESS.email || null} />
    </div>
  );
}
