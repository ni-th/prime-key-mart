import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BUSINESS } from "@/lib/business";
import { getCategories } from "@/lib/products";

/** How many categories the footer lists (the rest are under "All products"). */
const FOOTER_CATEGORIES = 5;

export async function SiteFooter() {
  const categories = (await getCategories()).slice(0, FOOTER_CATEGORIES);
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 md:grid-cols-4">
        <div className="space-y-2">
          <Logo className="h-6" />
          <p className="text-xs text-muted-foreground">
            Genuine software keys, delivered instantly to your inbox.
          </p>
        </div>

        <nav className="space-y-2 text-sm">
          <div className="font-medium">Shop</div>
          <Link href="/products" className="block text-muted-foreground hover:text-foreground">
            All products
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/products?category=${c.slug}`}
              className="block text-muted-foreground hover:text-foreground"
            >
              {c.name}
            </Link>
          ))}
        </nav>

        <nav className="space-y-2 text-sm">
          <div className="font-medium">Support</div>
          <Link href="/contact" className="block text-muted-foreground hover:text-foreground">
            Contact us
          </Link>
          <Link href="/order-lookup" className="block text-muted-foreground hover:text-foreground">
            Find my order
          </Link>
          <Link href="/legal/refund-policy" className="block text-muted-foreground hover:text-foreground">
            Refund policy
          </Link>
          <Link href="/legal/terms" className="block text-muted-foreground hover:text-foreground">
            Terms of service
          </Link>
          <Link href="/legal/privacy" className="block text-muted-foreground hover:text-foreground">
            Privacy policy
          </Link>
        </nav>

        <nav className="space-y-2 text-sm">
          <div className="font-medium">Account</div>
          <Link href="/login" className="block text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Link href="/register" className="block text-muted-foreground hover:text-foreground">
            Sign up
          </Link>
          <Link href="/account/orders" className="block text-muted-foreground hover:text-foreground">
            Order history
          </Link>
        </nav>
      </div>

      <div className="border-t py-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {BUSINESS.legalName}. All rights reserved.
          </p>
          <p>Secure payments by PayHere. Product names are trademarks of their owners.</p>
        </div>
      </div>
    </footer>
  );
}
