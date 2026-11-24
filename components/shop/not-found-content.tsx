import Link from "next/link";
import { KeyRound, Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPage } from "@/components/status-page";
import { getCategories } from "@/lib/products";
import { categoryPath } from "@/lib/category-url";
import { cn } from "@/lib/utils";

/**
 * The shop's 404: explains, then helps the visitor carry on (search, the
 * categories, home) instead of leaving.
 */
export async function NotFoundContent({
  title = "Page not found",
  message = "The page you're looking for doesn't exist or may have moved.",
}: {
  title?: string;
  message?: string;
}) {
  // A broken database shouldn't break the 404 page too.
  const categories = await getCategories().catch(() => []);

  return (
    <StatusPage code="404" icon={<KeyRound className="size-6" />} title={title}>
      <p className="mx-auto max-w-sm">{message}</p>

      <form action="/products" className="mx-auto flex max-w-sm gap-2" role="search">
        <label htmlFor="nf-search" className="sr-only">
          Search products
        </label>
        <Input id="nf-search" name="q" type="search" placeholder="Search Windows, Office, antivirus..." className="h-9" />
        <button type="submit" className={cn(buttonVariants({ size: "sm" }), "h-9")}>
          <Search className="size-4" />
          <span className="sr-only sm:not-sr-only">Search</span>
        </button>
      </form>

      {categories.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide">Or browse a category</p>
          <div className="flex flex-wrap justify-center gap-2">
            {categories.slice(0, 8).map((c) => (
              <Link
                key={c.id}
                href={categoryPath(c.slug)}
                className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className={cn(buttonVariants({ size: "sm" }))}>
          Go to the store
        </Link>
        <Link href="/contact" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Contact us
        </Link>
      </div>
    </StatusPage>
  );
}
