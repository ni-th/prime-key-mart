import Link from "next/link";
import { POLICIES_UPDATED } from "@/lib/business";

/** Shared layout for the policy pages (terms, privacy, refunds, contact). */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        Last updated {POLICIES_UPDATED}
      </p>
      {intro && (
        <p className="mt-6 text-sm leading-6 text-muted-foreground">{intro}</p>
      )}
      <div className="mt-8 space-y-7 text-sm leading-6 text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mb-1.5 [&_h2]:font-medium [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
      <p className="mt-10 text-xs text-muted-foreground">
        Questions about this page? <Link href="/contact" className="underline underline-offset-4">Contact us</Link>.
      </p>
    </div>
  );
}

/** "email us at ..." that degrades gracefully when no email is configured. */
export function SupportEmail({ email }: { email: string }) {
  if (!email) return <Link href="/contact">our contact page</Link>;
  return <a href={`mailto:${email}`}>{email}</a>;
}
