import type { Metadata } from "next";

export const metadata: Metadata = { title: "Refund policy" };

export default function RefundPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Refund policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        KeyMart is a demo project. This page is placeholder content.
      </p>

      <div className="mt-8 space-y-6 text-sm leading-6 text-muted-foreground">
        <section>
          <h2 className="font-medium text-foreground">Before a key is revealed</h2>
          <p>
            If your order has not yet been fulfilled, or a key could not be
            delivered, contact support and we will cancel and refund it in full.
          </p>
        </section>
        <section>
          <h2 className="font-medium text-foreground">After a key is revealed</h2>
          <p>
            Because a license key cannot be &ldquo;returned&rdquo;, revealed keys
            are generally non-refundable. The exception is a key that fails to
            activate and cannot be replaced - in that case we refund that line of
            the order.
          </p>
        </section>
        <section>
          <h2 className="font-medium text-foreground">Faulty keys</h2>
          <p>
            Report activation problems within 30 days with the error message you
            see. We will first try to issue a replacement key, then refund if no
            replacement is available.
          </p>
        </section>
        <section>
          <h2 className="font-medium text-foreground">How refunds are paid</h2>
          <p>
            Approved refunds go back to the original payment method, typically
            within 5–10 business days.
          </p>
        </section>
      </div>
    </div>
  );
}
