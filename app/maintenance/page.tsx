import type { Metadata } from "next";
import Link from "next/link";
import { Mail, PackageSearch } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { StatusPage } from "@/components/status-page";
import { readMaintenance } from "@/lib/maintenance";
import { BRAND } from "@/lib/brand";
import { BUSINESS } from "@/lib/business";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Back soon",
  robots: { index: false, follow: false },
};

// Always read the current message (it changes from the admin panel).
export const dynamic = "force-dynamic";

/**
 * Shown instead of shop pages while maintenance mode is on (the proxy
 * rewrites to it with a 503 status). Order pages keep working, so it points
 * customers to their keys.
 */
export default async function MaintenancePage() {
  const { message } = await readMaintenance().catch(() => ({ message: null }));

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <Logo className="h-8" priority />
        </div>
      </header>
      <main className="flex flex-1 items-center">
        <StatusPage code="503" title="We'll be right back">
          <p className="mx-auto max-w-sm">
            {BRAND.name} is down for a short maintenance. Thanks for your patience, please check back
            soon.
          </p>
          {message && (
            <p className="mx-auto max-w-sm rounded-lg border bg-muted/40 px-4 py-3 text-foreground">
              {message}
            </p>
          )}
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide">Already bought something?</p>
            <p className="mx-auto max-w-sm">
              Your keys are safe. Open the link in your order email, or find your order here.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/order-lookup" className={cn(buttonVariants({ size: "sm" }))}>
                <PackageSearch className="size-4" />
                Find my order
              </Link>
              {BUSINESS.email && (
                <a
                  href={`mailto:${BUSINESS.email}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  <Mail className="size-4" />
                  {BUSINESS.email}
                </a>
              )}
            </div>
          </div>
        </StatusPage>
      </main>
    </div>
  );
}
