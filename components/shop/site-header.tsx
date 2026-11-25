import Link from "next/link";
import { categoryPath } from "@/lib/category-url";
import { Search } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { auth } from "@/lib/auth";
import { getCategories } from "@/lib/products";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CartButton } from "@/components/shop/cart-button";
import { MobileNav } from "@/components/shop/mobile-nav";
import { AccountMenu } from "@/components/shop/account-menu";

export async function SiteHeader() {
  const [categories, session] = await Promise.all([getCategories(), auth()]);

  const navLinks = [
    { href: "/products", label: "All products" },
    ...categories.filter((c) => c.showInHeader).map((c) => ({
      href: categoryPath(c.slug),
      label: c.name,
    })),
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <MobileNav links={navLinks} />

        <Link href="/" aria-label="Keysby home" className="shrink-0">
          <Logo className="h-8" priority />
        </Link>

        {/* Category links only fit inline on wide screens; below xl they live
            in the menu (MobileNav), so the account buttons never overflow. */}
        <nav className="ml-4 hidden shrink-0 items-center gap-1 xl:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "text-muted-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
          {/* Search takes the leftover space and is the first thing to shrink. */}
          <form
            action="/products"
            className="relative hidden min-w-0 max-w-64 flex-1 sm:block"
            role="search"
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              name="q"
              maxLength={100}
              placeholder="Search keys…"
              className="h-8 w-full pl-8"
            />
          </form>

          <CartButton className="shrink-0" />

          {session?.user ? (
            <AccountMenu
              name={session.user.name ?? null}
              email={session.user.email ?? ""}
              isAdmin={session.user.role === "ADMIN"}
            />
          ) : (
            <>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "shrink-0",
                )}
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "hidden shrink-0 sm:inline-flex",
                )}
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
