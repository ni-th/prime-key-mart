import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ProductListItem } from "@/lib/products";
import { AddToCartButton } from "@/components/shop/add-to-cart-button";
import { ProductThumb } from "@/components/shop/product-thumb";
import { SaleBadge } from "@/components/shop/sale-badge";

export function ProductCard({ product }: { product: ProductListItem }) {
  const inStock = product.stock > 0;

  return (
    <Card className="group/card gap-0 py-0">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-[16/10] overflow-hidden"
      >
        <ProductThumb
          name={product.name}
          brand={product.brand}
          imageUrl={product.imageUrl}
          className="transition-transform duration-300 group-hover/card:scale-[1.03]"
        />
        {product.sale && (
          <SaleBadge percent={product.sale.percent} className="absolute top-2 left-2 shadow-sm" />
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{product.brand}</Badge>
          <span
            className={cn(
              "text-xs",
              inStock ? "text-success" : "text-muted-foreground",
            )}
          >
            {inStock ? "In stock" : "Out of stock"}
          </span>
        </div>

        <Link href={`/products/${product.slug}`} className="font-medium hover:underline">
          {product.name}
        </Link>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {product.shortDescription}
        </p>

        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className={cn("text-lg font-semibold", product.sale && "text-destructive")}>
              {formatUsd(product.salePriceCents)}
            </span>
            {product.sale && (
              <s className="text-sm text-muted-foreground tabular-nums">
                {formatUsd(product.priceCents)}
              </s>
            )}
          </span>
          <AddToCartButton
            size="sm"
            disabled={!inStock}
            product={{
              productId: product.id,
              slug: product.slug,
              name: product.name,
              priceCents: product.salePriceCents,
              brand: product.brand,
            }}
          />
        </div>
      </div>
    </Card>
  );
}
