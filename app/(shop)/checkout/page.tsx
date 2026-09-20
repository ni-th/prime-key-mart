import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { isPayHereConfigured } from "@/lib/payhere";
import { CheckoutForm } from "@/components/shop/checkout-form";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const session = await auth();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Checkout</h1>
      <CheckoutForm
        defaultEmail={session?.user?.email}
        emailLocked={Boolean(session?.user?.email)}
        mockMode={!isPayHereConfigured}
      />
    </div>
  );
}
