import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { allowMockPayments } from "@/lib/payhere";
import { CheckoutForm } from "@/components/shop/checkout-form";
import type { CustomerDetails } from "@/lib/validation";

export const metadata: Metadata = { title: "Checkout" };

/** Signed in: prefill from the account name and the last order's details. */
async function savedDetails(userId: string, name: string | null | undefined): Promise<Partial<CustomerDetails>> {
  const last = await prisma.order.findFirst({
    where: { userId, customerPhone: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { customerName: true, customerPhone: true, customerCountry: true },
  });
  const [firstName = "", ...rest] = (last?.customerName ?? name ?? "").trim().split(/\s+/);
  return {
    firstName,
    lastName: rest.join(" "),
    phone: last?.customerPhone ?? "",
    country: last?.customerCountry ?? "",
  };
}

export default async function CheckoutPage() {
  const session = await auth();
  const defaults = session?.user?.id ? await savedDetails(session.user.id, session.user.name) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Checkout</h1>
      <CheckoutForm
        defaultEmail={session?.user?.email}
        emailLocked={Boolean(session?.user?.email)}
        defaultCustomer={defaults}
        mockMode={allowMockPayments}
      />
    </div>
  );
}
