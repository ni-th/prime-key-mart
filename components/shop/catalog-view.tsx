import type { Category } from "@prisma/client";
import { getBrands, getCategories, getProducts, type ProductSort } from "@/lib/products";
import { ProductCard } from "@/components/shop/product-card";
import { CatalogFilters } from "@/components/shop/catalog-filters";
import { CategoryBanner } from "@/components/shop/category-banner";

export type CatalogSearchParams = Record<string, string | string[] | undefined>;

const VALID_SORTS: ProductSort[] = ["featured", "price-asc", "price-desc", "newest"];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Product grid with filters. Rendered by /products (all products) and
 * /category/[slug] (one category, with its banner and description).
 */
export async function CatalogView({
  category,
  searchParams: sp,
}: {
  category: Category | null;
  searchParams: CatalogSearchParams;
}) {
  const q = first(sp.q)?.trim() || undefined;
  const brand = first(sp.brand) || undefined;
  const sortRaw = first(sp.sort);
  const sort = VALID_SORTS.includes(sortRaw as ProductSort) ? (sortRaw as ProductSort) : undefined;

  const [products, categories, brands] = await Promise.all([
    getProducts({ q, category: category?.slug, brand, sort }),
    getCategories(),
    getBrands(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {category && (
        <CategoryBanner
          name={category.name}
          bannerUrl={category.bannerUrl}
          bannerMobileUrl={category.bannerMobileUrl}
        />
      )}
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {category ? category.name : "All products"}
        </h1>
        {category?.description && (
          <p className="max-w-2xl text-muted-foreground">{category.description}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {q ? (
            <>
              {products.length} result{products.length === 1 ? "" : "s"} for &ldquo;{q}&rdquo;
            </>
          ) : (
            <>
              {products.length} product{products.length === 1 ? "" : "s"}
            </>
          )}
        </p>
      </div>

      <div className="mb-6">
        <CatalogFilters
          categories={categories}
          brands={brands}
          activeCategory={category?.slug ?? null}
        />
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No products match those filters.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
