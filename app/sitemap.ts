import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { categoryPath } from "@/lib/category-url";
import { absoluteUrl } from "@/lib/seo";

// Rebuilt at most hourly; catalog edits in admin also revalidate it right away.
export const revalidate = 3600;

const STATIC_PAGES: { path: string; priority: number; changeFrequency: "daily" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/products", priority: 0.9, changeFrequency: "daily" },
  { path: "/contact", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/legal/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/legal/refund-policy", priority: 0.2, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true, imageUrl: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.category.findMany({
      where: { visible: true },
      select: { slug: true, updatedAt: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  return [
    ...STATIC_PAGES.map((p) => ({
      url: absoluteUrl(p.path),
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    })),
    ...categories.map((c) => ({
      url: absoluteUrl(categoryPath(c.slug)),
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...products.map((p) => ({
      url: absoluteUrl(`/products/${encodeURIComponent(p.slug)}`),
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
      ...(p.imageUrl ? { images: [absoluteUrl(p.imageUrl)] } : {}),
    })),
  ];
}
