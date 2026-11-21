import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Clock, Mail, Phone, Search } from "lucide-react";
import { BUSINESS } from "@/lib/business";
import { LegalPage } from "@/components/shop/legal-page";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Get help with an order, a key that won't activate, or a refund.",
};

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-foreground" />
      <div>
        <div className="font-medium text-foreground">{label}</div>
        <div>{children}</div>
      </div>
    </div>
  );
}

export default function ContactPage() {
  const b = BUSINESS;
  return (
    <LegalPage
      title="Contact us"
      intro="Need help with an order, a key that won't activate, or a refund? We're happy to help. Including your order number (from your confirmation email) gets you an answer faster."
    >
      <div className="space-y-5 rounded-xl border p-5">
        {b.email && (
          <Row icon={Mail} label="Email">
            <a href={`mailto:${b.email}`}>{b.email}</a>
          </Row>
        )}
        {b.phone && (
          <Row icon={Phone} label="Phone">
            <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`}>{b.phone}</a>
          </Row>
        )}
        <Row icon={Clock} label="Response time">
          We reply to every message within 1 business day.
        </Row>
        {b.address && (
          <Row icon={Building2} label={b.legalName}>
            {b.address}
            {b.registrationNo && <div>Registration no. {b.registrationNo}</div>}
          </Row>
        )}
      </div>

      <section>
        <h2>Looking for your keys?</h2>
        <p>
          You can find any order with your email and order number on{" "}
          <Link href="/order-lookup">
            <Search className="mr-1 inline size-3.5 align-[-2px]" />
            order lookup
          </Link>
          , or in <Link href="/account/orders">your account</Link> if you bought
          while signed in.
        </p>
      </section>

      <section>
        <h2>Refunds and faulty keys</h2>
        <p>
          See our <Link href="/legal/refund-policy">refund policy</Link> for when
          and how we replace or refund keys.
        </p>
      </section>
    </LegalPage>
  );
}
