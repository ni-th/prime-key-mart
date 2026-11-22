import Link from "next/link";
import { connection } from "next/server";
import { Logo } from "@/components/brand/logo";
import { TurnstileProvider } from "@/components/auth/turnstile";
import { turnstileSiteKey } from "@/lib/turnstile";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read env at request time, not build time, so key changes apply on restart.
  await connection();
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-16">
      <Link href="/" aria-label="Keysby home" className="mb-8">
        <Logo className="h-10" />
      </Link>
      <div className="w-full max-w-sm">
        <TurnstileProvider siteKey={turnstileSiteKey()}>{children}</TurnstileProvider>
      </div>
      <Link
        href="/"
        className="mt-8 text-xs text-muted-foreground hover:text-foreground"
      >
        ← Back to store
      </Link>
    </div>
  );
}
