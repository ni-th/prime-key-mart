import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getCategoryBySlug, resolveOldCategorySlug } from "@/lib/products";
import { categoryPath } from "@/lib/category-url";
import { CatalogView, type CatalogSearchParams } from "@/components/shop/catalog-view";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return {};
  return {
    title: category.name,
    description:
      category.description ?? `Genuine ${category.name} license keys, delivered instantly.`,
    alternates: { canonical: categoryPath(category.slug) },
    openGraph: category.bannerUrl ? { images: [category.bannerUrl] } : undefined,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<CatalogSearchParams>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const category = await getCategoryBySlug(slug);

  if (!category) {
    // Renamed category: send old links to the new address (keeps filters).
    const current = await resolveOldCategorySlug(slug);
    if (current) {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(sp)) {
        if (value === undefined) continue;
        for (const v of Array.isArray(value) ? value : [value]) query.append(key, v);
      }
      const qs = query.toString();
      permanentRedirect(`${categoryPath(current)}${qs ? `?${qs}` : ""}`);
    }
    notFound();
  }

  return <CatalogView category={category} searchParams={sp} />;
}
