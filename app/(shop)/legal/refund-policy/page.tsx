import type { Metadata } from "next";
import { BUSINESS } from "@/lib/business";
import { LegalPage, SupportEmail } from "@/components/shop/legal-page";

export const metadata: Metadata = { title: "Refund policy" };

export default function RefundPolicyPage() {
  const b = BUSINESS;
  return (
    <LegalPage
      title="Refund policy"
      intro="License keys are digital and are delivered instantly, so refunds work a little differently from physical goods. Here is exactly when you can get your money back."
    >
      <section>
        <h2>Order not delivered</h2>
        <p>
          If you paid but did not receive a key, contact us and we will either
          deliver it or refund you in full.
        </p>
      </section>

      <section>
        <h2>Key does not work</h2>
        <p>
          If a key fails to activate, tell us within 30 days of purchase. Please
          include your order number and a screenshot or the exact error message.
          We will send a working replacement key, or, if we cannot replace it,
          refund that item in full.
        </p>
      </section>

      <section>
        <h2>Wrong product or changed your mind</h2>
        <p>
          A delivered key cannot be returned, because it could already have been
          used. For that reason we cannot refund delivered keys for a change of
          mind or for buying the wrong edition or region. Please check the
          product details before you pay. If you contact us before you have
          used the key, we will look at it case by case.
        </p>
      </section>

      <section>
        <h2>Duplicate payments</h2>
        <p>
          If you were charged twice for the same order, we refund the extra
          payment in full.
        </p>
      </section>

      <section>
        <h2>How refunds are paid</h2>
        <p>
          Approved refunds go back to the card or account you paid with, through
          PayHere. Depending on your bank, the money usually appears within 5 to
          10 business days. The refunded key is deactivated or withdrawn.
        </p>
      </section>

      <section>
        <h2>How to ask for a refund</h2>
        <p>
          Email <SupportEmail email={b.email} />
          {b.phone ? ` or call ${b.phone}` : ""} with your order number (you&apos;ll find
          it in your confirmation email). We reply within 1 business
          day.
        </p>
      </section>
    </LegalPage>
  );
}
