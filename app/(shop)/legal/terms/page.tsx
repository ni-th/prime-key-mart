import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Terms of service</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Keysby is a demo project. This page is placeholder content, not real
        legal terms.
      </p>

      <div className="mt-8 space-y-6 text-sm leading-6 text-muted-foreground">
        <section>
          <h2 className="font-medium text-foreground">1. What we sell</h2>
          <p>
            Keysby lists software license keys for operating systems, office
            suites and security software. Each order delivers one or more
            25-character product keys or redemption codes by email.
          </p>
        </section>
        <section>
          <h2 className="font-medium text-foreground">2. Delivery</h2>
          <p>
            Keys are delivered digitally, normally within a few minutes of a
            successful payment. They are also available in your account and via
            the order-lookup page.
          </p>
        </section>
        <section>
          <h2 className="font-medium text-foreground">3. Activation</h2>
          <p>
            You are responsible for entering the key on a compatible platform.
            Once a key has been revealed to you it is considered delivered.
          </p>
        </section>
        <section>
          <h2 className="font-medium text-foreground">4. Acceptable use</h2>
          <p>
            Do not resell, publish or share keys purchased through Keysby.
            Fraudulent chargebacks may result in keys being revoked where the
            publisher supports it.
          </p>
        </section>
        <section>
          <h2 className="font-medium text-foreground">5. Liability</h2>
          <p>
            As a demo, Keysby is provided &ldquo;as is&rdquo; with no warranty
            of any kind.
          </p>
        </section>
      </div>
    </div>
  );
}
