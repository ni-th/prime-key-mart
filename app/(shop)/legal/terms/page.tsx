import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import { LegalPage, SupportEmail } from "@/components/shop/legal-page";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  const b = BUSINESS;
  return (
    <LegalPage
      title="Terms of service"
      intro={
        <>
          These terms apply to every purchase from Keysby, operated by{" "}
          {b.legalName}
          {b.address ? `, ${b.address}` : ""}. By placing an order you agree to
          them, so please read them before you buy.
        </>
      }
    >
      <section>
        <h2>1. What we sell</h2>
        <p>
          Keysby sells digital license keys and activation codes for operating
          systems, office software, security software and server products. Each
          product page states the edition, the number of devices or users, the
          license term and the region the key works in. Check these before you
          buy; they cannot be changed after delivery.
        </p>
      </section>

      <section>
        <h2>2. Prices and payment</h2>
        <p>
          Prices are shown in the currency selected at checkout and include all
          charges we make. Payments are processed securely by PayHere; we never
          see or store your full card details. Your order is confirmed once
          PayHere tells us the payment succeeded.
        </p>
      </section>

      <section>
        <h2>3. Delivery</h2>
        <p>
          Keys are delivered digitally, normally within a few minutes of a
          successful payment, to the email address on the order. They also
          appear on the order confirmation page, in your account (if you have
          one) and through <Link href="/order-lookup">order lookup</Link>. If you
          have not received your key within 2 hours, check your spam folder and
          then contact us. No physical item is shipped.
        </p>
      </section>

      <section>
        <h2>4. Activation and compatibility</h2>
        <p>
          You are responsible for making sure the product suits your device and
          for entering the key on a compatible system. A key counts as delivered
          once it has been shown or emailed to you. If a key does not activate,
          our <Link href="/legal/refund-policy">refund policy</Link> explains how
          we replace or refund it.
        </p>
      </section>

      <section>
        <h2>5. Your account</h2>
        <p>
          You can buy as a guest or with an account. Keep your password private;
          you are responsible for orders placed through your account. We may
          suspend accounts or refuse orders that we reasonably believe involve
          fraud, abuse or a breach of these terms.
        </p>
      </section>

      <section>
        <h2>6. Acceptable use</h2>
        <ul>
          <li>Keys are for your own use or for the person you bought them for.</li>
          <li>Do not resell, publish or share keys bought from Keysby.</li>
          <li>
            Chargebacks for orders that were delivered may lead to the account
            being closed and, where the publisher allows it, the key being
            deactivated.
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Software publishers</h2>
        <p>
          The software itself is provided by its publisher (for example
          Microsoft or Norton) and is subject to the publisher&apos;s own license
          terms. Product names and trademarks belong to their owners.
        </p>
      </section>

      <section>
        <h2>8. Liability</h2>
        <p>
          If something goes wrong with an order, our responsibility is limited to
          replacing the key or refunding the amount you paid for it. We are not
          liable for indirect losses such as lost data or lost profits. Nothing
          in these terms limits rights you have under consumer law that cannot
          be excluded.
        </p>
      </section>

      <section>
        <h2>9. Changes and governing law</h2>
        <p>
          We may update these terms; the version shown when you place an order
          applies to that order. These terms are governed by the laws of{" "}
          {b.country}.
        </p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>
          Questions about an order or these terms: email{" "}
          <SupportEmail email={b.email} />
          {b.phone ? ` or call ${b.phone}` : ""}.
        </p>
      </section>
    </LegalPage>
  );
}
