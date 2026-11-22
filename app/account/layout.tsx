import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/shop/site-header";
import { SiteFooter } from "@/components/shop/site-footer";
import { AccountNav } from "@/components/account/account-nav";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/account");

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      {/* Small screens: the sidebar is hidden, so show the sections as tabs. */}
      <div className="border-b md:hidden">
        <div className="mx-auto max-w-6xl px-4 py-2">
          <AccountNav orientation="horizontal" />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 py-8 md:py-10">
        {/* Sticky just below the 3.5rem header (+ the page padding). */}
        <aside className="sticky top-22 hidden h-fit w-44 shrink-0 self-start md:block">
          <AccountNav orientation="vertical" />
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <SiteFooter />
    </div>
  );
}
