import type { Metadata } from "next";
import { categoryPath } from "@/lib/category-url";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Mail, ShieldCheck, Zap } from "lucide-react";
import { getProductBySlug } from "@/lib/products";
import { formatMoney, formatUsd } from "@/lib/money";
import { getActiveDiscounts, getPricingSettings, priceOf } from "@/lib/pricing";
import { endsInText } from "@/lib/sale";
import { getWarrantyOptions } from "@/lib/warranty-server";
import { getFreeCheckHours } from "@/lib/warranty-claims";
import { priceWarranties } from "@/lib/warranty";
import { SaleBadge } from "@/components/shop/sale-badge";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ProductThumb } from "@/components/shop/product-thumb";
import { ProductBuyBox } from "@/components/shop/product-buy-box";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: product.shortDescription,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [settings, discounts, warrantyOptions, freeCheckHours] = await Promise.all([
    getPricingSettings(),
    getActiveDiscounts(),
    getWarrantyOptions([product.id]),
    getFreeCheckHours(),
  ]);
  const price = priceOf(product, settings, discounts);
  // Warranty is a percent of the normal price (sales don't discount it).
  const warranties = priceWarranties(warrantyOptions.get(product.id) ?? [], {
    usdCents: price.listUsdCents,
    lkrCents: price.listLkrCents,
  });
  const endsIn = price.sale ? endsInText(price.sale.endsAt) : null;

  const inStock = product.stock > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/products" className="hover:text-foreground">
          Products
        </Link>
        <ChevronRight className="size-3" />
        <Link
          href={categoryPath(product.category.slug)}
          className="hover:text-foreground"
        >
          {product.category.name}
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        {/* self-start: don't stretch to the (taller) details column, which
            left an empty band under the image. */}
        <div className="self-start overflow-hidden rounded-xl border ring-1 ring-foreground/10">
          <div className="aspect-16/10">
            <ProductThumb
              name={product.name}
              brand={product.brand}
              imageUrl={product.imageUrl}
              width={1200}
            />
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{product.brand}</Badge>
            <Badge variant="outline">{product.platform}</Badge>
            <Badge variant="outline">Region: {product.region}</Badge>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              {product.name}
            </h1>
            <p className="text-muted-foreground">{product.shortDescription}</p>
          </div>

          {price.sale && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <SaleBadge percent={price.sale.percent} />
              <span className="font-medium">{price.sale.name}</span>
              {endsIn && <span className="text-muted-foreground">· {endsIn}</span>}
            </div>
          )}

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={price.sale ? "text-3xl font-semibold text-destructive" : "text-3xl font-semibold"}>
              {formatUsd(price.usdCents)}
            </span>
            {price.sale && (
              <s className="text-lg text-muted-foreground tabular-nums">
                {formatUsd(price.listUsdCents)}
              </s>
            )}
            <span className="text-base text-muted-foreground tabular-nums">
              {formatMoney(price.lkrCents, "LKR")}
              {price.sale && (
                <s className="ml-1.5 text-sm">{formatMoney(price.listLkrCents, "LKR")}</s>
              )}
            </span>
            <span
              className={
                inStock
                  ? "text-sm text-success"
                  : "text-sm text-muted-foreground"
              }
            >
              {inStock ? "In stock" : "Currently out of stock"}
            </span>
          </div>

          <ProductBuyBox
            stock={product.stock}
            warranties={warranties}
            unitLkrCents={price.lkrCents}
            freeCheckHours={freeCheckHours}
            product={{
              productId: product.id,
              slug: product.slug,
              name: product.name,
              priceCents: price.usdCents,
              brand: product.brand,
            }}
          />

          <Separator />

          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <Zap className="size-4 shrink-0 text-primary" />
              Delivered by email within minutes of payment.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="size-4 shrink-0 text-primary" />
              Secure PayHere checkout - guest checkout available.
            </li>
            <li className="flex gap-2">
              <Mail className="size-4 shrink-0 text-primary" />
              Keys stay in your account and are re-viewable any time.
            </li>
          </ul>
        </div>
      </div>

      <section className="mt-12 max-w-3xl">
        <h2 className="mb-3 text-lg font-semibold">About this license</h2>
        <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
          {product.description}
        </p>
      </section>
    </div>
  );
}
