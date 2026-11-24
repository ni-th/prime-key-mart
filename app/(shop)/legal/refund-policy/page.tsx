import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import { LegalPage, SupportEmail } from "@/components/shop/legal-page";
import { getFreeCheckHours } from "@/lib/warranty-claims";
import { checkPeriod } from "@/lib/warranty-claim-shared";
import { ACTIVATION_LIMIT, ACTIVATION_REPLY_TIME } from "@/lib/delivery";

export const metadata: Metadata = { title: "Refund and warranty policy" };

export default async function RefundPolicyPage() {
  const b = BUSINESS;
  const hours = await getFreeCheckHours();
  const period = checkPeriod(hours);
  return (
    <LegalPage
      title="Refund and warranty policy"
      intro="License keys are digital and are delivered instantly, so refunds work differently from physical goods. This page explains when we replace a key, when we refund it, and what is not covered."
    >
      <section>
        <h2>1. Check your key straight away</h2>
        {hours > 0 ? (
          <p>
            Please activate every key as soon as you receive it. Every key,
            with or without a warranty, can be reported within{" "}
            <strong>{period} of delivery</strong> if it does not activate. After
            that, only keys with a warranty are covered. The same applies to
            accounts (username and password).
          </p>
        ) : (
          <p>
            Please activate every key as soon as you receive it. Keys without a
            warranty are not covered once they have been delivered, so check
            them straight away and contact us at once if one does not activate.
          </p>
        )}
      </section>

      <section>
        <h2>Keys activated by phone</h2>
        <p>
          Some keys (for example Office 2019) are activated by phone. After
          you enter the key, the software shows an Installation ID. Send it
          from your order page and we reply with the Confirmation ID,{" "}
          {ACTIVATION_REPLY_TIME}.{" "}
          {hours > 0
            ? `For these keys the ${period} check period starts when we send the Confirmation ID, not at delivery.`
            : "Finish the activation as soon as you receive the Confirmation ID, and contact us at once if it does not work."}{" "}
          Each key includes {ACTIVATION_LIMIT} activation requests (for example
          after reinstalling); contact us if you need more.
        </p>
      </section>

      <section>
        <h2>2. Warranty</h2>
        <p>
          Some products offer an optional warranty at checkout. The warranty
          length is shown on the product page and on your order. While the
          warranty runs, you can report a key that stops working through no
          fault of your own, and we will replace it or refund it.
        </p>
        <p className="mt-2">
          A replacement key keeps the original warranty end date. The warranty
          does not start again.
        </p>
      </section>

      <section>
        <h2>3. What is not covered</h2>
        <p>
          We cannot replace or refund a key, even during the check period or
          a warranty, when the problem is caused by:
        </p>
        <ul className="mt-2">
          <li>
            Losing access to an account we supplied (for example a Microsoft 365
            account), such as a forgotten password, or changing its email
            address or recovery details. You may change the password, but you
            must remember it: we cannot recover or replace an account if you
            forget the new password.
          </li>
          <li>Sharing, reselling or publishing the key or account.</li>
          <li>
            Buying the wrong edition, region or platform. Please check the
            product page before you pay.
          </li>
          <li>
            Moving a license that is tied to one device to a new device, or
            replacing major hardware, unless the product page says the license
            can be transferred.
          </li>
          <li>A subscription ending normally at the end of its term.</li>
          <li>
            Breaking the software publisher&apos;s license terms, or opening a
            chargeback with your bank.
          </li>
          <li>
            Changes the software publisher makes that affect all users, not
            only your key.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. How to report a key</h2>
        <p>
          Open your order using the link in your keys email, or go to{" "}
          <Link href="/account/keys">My keys</Link> in your account. Tap{" "}
          <strong>Key not working?</strong> under the key, choose what went
          wrong and add the exact error message if you can. The link is shown
          for as long as the key is covered. We check every report and reply by
          email, usually within 24 hours.
        </p>
      </section>

      <section>
        <h2>5. Replacement or refund</h2>
        <p>
          If the report is covered, we send you a working replacement key. If we
          cannot replace it, we refund <strong>that key only</strong>: the price
          you paid for it plus its warranty fee. Other keys in the same order
          are not affected.
        </p>
        <p className="mt-2">
          The warranty fee cannot be refunded on its own once the key has been
          delivered.
        </p>
      </section>

      <section>
        <h2>6. Wrong product or changed your mind</h2>
        <p>
          A delivered key cannot be returned, because it could already have been
          used. For that reason we cannot refund delivered keys for a change of
          mind or for buying the wrong edition or region. If you contact us
          before you have used the key, we will look at it case by case.
        </p>
      </section>

      <section>
        <h2>7. Order not delivered or charged twice</h2>
        <p>
          If you paid but did not receive your keys, contact us and we will
          either deliver them or refund the order in full. If you were charged
          twice for the same order, we refund the extra payment in full.
        </p>
      </section>

      <section>
        <h2>8. How refunds are paid</h2>
        <p>
          Approved refunds go back to the card or account you paid with, through
          PayHere. Depending on your bank, the money usually appears within 5 to
          10 business days. A refunded key is withdrawn and must not be used.
        </p>
      </section>

      <section>
        <h2>9. Contact</h2>
        <p>
          For anything else, email <SupportEmail email={b.email} />
          {b.phone ? ` or call ${b.phone}` : ""} with your order number (it is in
          your keys email). We reply within 1 business day.
        </p>
      </section>
    </LegalPage>
  );
}
