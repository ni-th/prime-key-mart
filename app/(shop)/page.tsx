import Link from "next/link";
import { BadgeCheck, Mail, ShieldCheck, Zap } from "lucide-react";
import { getCategories, getFeaturedProducts } from "@/lib/products";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { optimizedImageUrl } from "@/lib/image-url";
import { ProductCard } from "@/components/shop/product-card";

export default async function HomePage() {
  const [featured, categories] = await Promise.all([
    getFeaturedProducts(4),
    getCategories(),
  ]);
  // The hero's second button points at the first category (admin-ordered).
  const heroCategory = categories[0];

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* Hero */}
      <section className="flex flex-col items-start gap-6 py-16 md:py-24">
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          <Zap className="size-3.5 text-primary" />
          Instant digital delivery
        </span>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          Genuine software keys, at a fair price.
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Windows, Microsoft Office and antivirus licenses - bought in seconds,
          delivered straight to your inbox with clear activation instructions.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/products" className={cn(buttonVariants({ size: "lg" }))}>
            Browse all keys
          </Link>
          {heroCategory && (
            <Link
              href={`/products?category=${heroCategory.slug}`}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Shop {heroCategory.name}
            </Link>
          )}
        </div>
      </section>

      {/* Trust strip */}
      <section className="grid gap-4 border-y py-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Zap, title: "Instant delivery", body: "Keys land in your inbox right after payment." },
          { icon: ShieldCheck, title: "Secure checkout", body: "Payments handled by PayHere. We never see your card." },
          { icon: BadgeCheck, title: "Genuine licenses", body: "Sourced to activate the first time, every time." },
          { icon: Mail, title: "Real support", body: "Lost a key? Look it up or email us any time." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-3">
            <Icon className="size-5 shrink-0 text-primary" />
            <div>
              <div className="text-sm font-medium">{title}</div>
              <p className="text-xs text-muted-foreground">{body}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="py-12">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-2xl font-semibold tracking-tight">Popular right now</h2>
            <Link
              href="/products"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              View all
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="py-12">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">Shop by category</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/products?category=${category.slug}`}
              className="overflow-hidden rounded-xl border bg-card ring-1 ring-foreground/10 transition-colors hover:bg-muted/50"
            >
              {(category.bannerMobileUrl ?? category.bannerUrl) && (
                // eslint-disable-next-line @next/next/no-img-element -- Cloudinary handles sizing
                <img
                  src={optimizedImageUrl((category.bannerMobileUrl ?? category.bannerUrl)!, 600)}
                  alt=""
                  loading="lazy"
                  className="aspect-2/1 w-full border-b object-cover"
                />
              )}
              <div className="p-5 pb-0 font-medium">{category.name}</div>
              <div className="mt-1 px-5 pb-5 text-sm text-muted-foreground">Browse →</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
