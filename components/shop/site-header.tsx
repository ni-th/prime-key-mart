import Link from "next/link";
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
    ...categories.map((c) => ({
      href: `/products?category=${c.slug}`,
      label: c.name,
    })),
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <MobileNav links={navLinks} />

        <Link href="/" aria-label="Keysby home">
          <Logo className="text-base" markClassName="size-7" />
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
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

        <div className="ml-auto flex items-center gap-2">
          <form
            action="/products"
            className="relative hidden sm:block"
            role="search"
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              name="q"
              placeholder="Search keys…"
              className="h-8 w-40 pl-8 lg:w-56"
            />
          </form>

          <CartButton />

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
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "hidden sm:inline-flex",
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
