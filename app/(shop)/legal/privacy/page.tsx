import type { Metadata } from "next";
import { BUSINESS } from "@/lib/business";
import { LegalPage, SupportEmail } from "@/components/shop/legal-page";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  const b = BUSINESS;
  return (
    <LegalPage
      title="Privacy policy"
      intro={
        <>
          This policy explains what personal information Keysby ({b.legalName})
          collects, why, and what you can do about it. We only collect what we
          need to sell and deliver your keys.
        </>
      }
    >
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Order details:</strong> your email address, the products you
            bought, prices and the keys delivered to you.
          </li>
          <li>
            <strong>Account details</strong> (if you create one): your name,
            email address and a securely hashed password. We cannot see your
            password.
          </li>
          <li>
            <strong>Payment status:</strong> whether a payment succeeded and its
            reference. Card details are entered on PayHere&apos;s secure page; we
            never receive or store them.
          </li>
          <li>
            <strong>Technical data:</strong> basic logs such as IP address and
            browser type, kept by our hosting provider for security and to fix
            problems.
          </li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To process your order and email you your keys.</li>
          <li>To let you see past orders and keys in your account.</li>
          <li>To answer support requests and handle refunds.</li>
          <li>To prevent fraud and keep the store secure.</li>
        </ul>
        <p className="mt-2">
          We do not sell your information and we do not send marketing email
          unless you ask us to.
        </p>
      </section>

      <section>
        <h2>Who we share it with</h2>
        <p>
          Only the services needed to run the store: PayHere (payments), our
          hosting and database providers, and our email provider (to send your
          keys). Each of them handles your data only to provide that service. We
          may also disclose information if the law requires it.
        </p>
      </section>

      <section>
        <h2>Cookies and local storage</h2>
        <p>
          We use one essential cookie to keep you signed in, and your
          browser&apos;s local storage to remember your cart. We do not use
          advertising or tracking cookies.
        </p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          Order records are kept for as long as we need them for accounting, tax
          and support, so you can retrieve your keys later. Account details are
          kept until you ask us to delete your account.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <p>
          You can ask for a copy of your information, ask us to correct it, or
          ask us to delete your account. Email <SupportEmail email={b.email} />{" "}
          from the address on your account and we will reply within 7 days.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          License keys are encrypted in our database, passwords are hashed, and
          the whole site uses HTTPS.
        </p>
      </section>
    </LegalPage>
  );
}
