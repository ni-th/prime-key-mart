import type { Metadata } from "next";
import {
  getBrands,
  getCategories,
  getCategoryBySlug,
  getProducts,
  type ProductSort,
} from "@/lib/products";
import { ProductCard } from "@/components/shop/product-card";
import { CatalogFilters } from "@/components/shop/catalog-filters";
import { CategoryBanner } from "@/components/shop/category-banner";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const raw = (await searchParams).category;
  const slug = Array.isArray(raw) ? raw[0] : raw;
  const category = slug ? await getCategoryBySlug(slug) : null;
  if (category) {
    return {
      title: category.name,
      description:
        category.description ?? `Genuine ${category.name} license keys, delivered instantly.`,
      openGraph: category.bannerUrl ? { images: [category.bannerUrl] } : undefined,
    };
  }
  return {
    title: "All products",
    description: "Browse every Windows, Office and antivirus license we sell.",
  };
}

const VALID_SORTS: ProductSort[] = [
  "featured",
  "price-asc",
  "price-desc",
  "newest",
];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  const q = first(sp.q)?.trim() || undefined;
  const category = first(sp.category) || undefined;
  const brand = first(sp.brand) || undefined;
  const sortRaw = first(sp.sort);
  const sort = VALID_SORTS.includes(sortRaw as ProductSort)
    ? (sortRaw as ProductSort)
    : undefined;

  const [products, categories, brands] = await Promise.all([
    getProducts({ q, category, brand, sort }),
    getCategories(),
    getBrands(),
  ]);

  const activeCategory = categories.find((c) => c.slug === category);
  const heading = activeCategory ? activeCategory.name : "All products";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {activeCategory && (
        <CategoryBanner
          name={activeCategory.name}
          bannerUrl={activeCategory.bannerUrl}
          bannerMobileUrl={activeCategory.bannerMobileUrl}
        />
      )}
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        {activeCategory?.description && (
          <p className="max-w-2xl text-muted-foreground">{activeCategory.description}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {q ? (
            <>
              {products.length} result{products.length === 1 ? "" : "s"} for
              &ldquo;{q}&rdquo;
            </>
          ) : (
            <>
              {products.length} product{products.length === 1 ? "" : "s"}
            </>
          )}
        </p>
      </div>

      <div className="mb-6">
        <CatalogFilters categories={categories} brands={brands} />
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No products match those filters.
          </p>
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
