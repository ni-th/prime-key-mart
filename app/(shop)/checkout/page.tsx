import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { allowMockPayments } from "@/lib/payhere";
import { getPaymentSettings } from "@/lib/payment-settings";
import { CheckoutForm } from "@/components/shop/checkout-form";
import type { CustomerDetails } from "@/lib/validation";

export const metadata: Metadata = { title: "Checkout" };

/**
 * Signed in: prefill the PayHere name from the account (first / last name
 * given at sign-up), and phone / country from the last order.
 */
async function savedDetails(userId: string): Promise<Partial<CustomerDetails>> {
  const [user, last] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, name: true } }),
    prisma.order.findFirst({
      where: { userId, customerPhone: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { customerName: true, customerPhone: true, customerCountry: true },
    }),
  ]);
  // Older accounts may lack the split name: fall back to splitting a full one.
  const [splitFirst = "", ...rest] = (last?.customerName ?? user?.name ?? "").trim().split(/\s+/);
  return {
    firstName: user?.firstName || splitFirst,
    lastName: user?.firstName ? (user.lastName ?? "") : rest.join(" "),
    phone: last?.customerPhone ?? "",
    country: last?.customerCountry ?? "",
  };
}

export default async function CheckoutPage() {
  const session = await auth();
  const [defaults, payment] = await Promise.all([
    session?.user?.id ? savedDetails(session.user.id) : null,
    getPaymentSettings(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Checkout</h1>
      <CheckoutForm
        defaultEmail={session?.user?.email}
        emailLocked={Boolean(session?.user?.email)}
        defaultCustomer={defaults}
        mockMode={allowMockPayments}
        usdEnabled={payment.usdEnabled}
        limits={payment.limits}
      />
    </div>
  );
}
