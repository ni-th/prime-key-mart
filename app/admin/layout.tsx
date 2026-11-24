import Link from "next/link";
import { redirect } from "next/navigation";
import { Store } from "lucide-react";
import { auth } from "@/lib/auth";
import { getAdminSession } from "@/lib/admin";
import { Logo } from "@/components/brand/logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { MaintenanceBanner } from "@/components/maintenance-banner";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminSession();
  if (!admin) {
    // An admin who hasn't passed 2FA in this session: set it up or re-sign-in.
    const session = await auth();
    if (session?.user?.role === "ADMIN") redirect("/two-factor");
    redirect("/login?callbackUrl=/admin");
  }

  return (
    <div className="flex min-h-full flex-col">
      <MaintenanceBanner />
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo className="h-7" />
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              Admin
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">
              {admin.user.email}
            </span>
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Store className="size-4" />
              View store
            </Link>
          </div>
        </div>
        {/* Small screens: the sidebar is hidden, so show the sections as tabs. */}
        <div className="mx-auto max-w-6xl px-4 pb-2 md:hidden">
          <AdminNav orientation="horizontal" />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 py-8">
        {/* Sticky just below the 3.5rem header (+ the 2rem page padding). */}
        <aside className="sticky top-22 hidden h-fit w-44 shrink-0 self-start md:block">
          <AdminNav orientation="vertical" />
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
