import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { categoryPath } from "@/lib/category-url";
import { CatalogView, type CatalogSearchParams } from "@/components/shop/catalog-view";

export const metadata: Metadata = {
  title: "All products",
  description: "Browse every Windows, Office and antivirus license we sell.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const sp = await searchParams;

  // Old-style category links (/products?category=x) move to /category/x,
  // keeping any other filters. The category page handles renamed slugs.
  const raw = sp.category;
  const slug = Array.isArray(raw) ? raw[0] : raw;
  if (slug) {
    const rest = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (key === "category" || value === undefined) continue;
      for (const v of Array.isArray(value) ? value : [value]) rest.append(key, v);
    }
    const query = rest.toString();
    permanentRedirect(`${categoryPath(slug)}${query ? `?${query}` : ""}`);
  }

  return <CatalogView category={null} searchParams={sp} />;
}
