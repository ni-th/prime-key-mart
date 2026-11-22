import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ProductSort = "featured" | "price-asc" | "price-desc" | "newest";

export type ProductListItem = Awaited<ReturnType<typeof getProducts>>[number];

const categoryOrder: Prisma.CategoryOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { name: "asc" },
];

/** Categories shown in the shop (visible ones only), in display order. */
export async function getCategories() {
  return prisma.category.findMany({ where: { visible: true }, orderBy: categoryOrder });
}

/** Every category, hidden ones included. For admin dropdowns and filters. */
export async function getAllCategories() {
  return prisma.category.findMany({ orderBy: categoryOrder });
}

/** A visible category by slug, for its page (banner, description). */
export async function getCategoryBySlug(slug: string) {
  const category = await prisma.category.findUnique({ where: { slug } });
  return category?.visible ? category : null;
}

export async function getBrands(): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: { published: true },
    select: { brand: true },
    distinct: ["brand"],
    orderBy: { brand: "asc" },
  });
  return rows.map((r) => r.brand);
}

/** Map of productId -> number of AVAILABLE license keys. */
export async function availableStockByProduct(
  productIds: string[],
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const groups = await prisma.licenseKey.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds }, status: "AVAILABLE" },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.productId, g._count._all]));
}

function withStock<T extends { id: string }>(
  products: T[],
  stock: Map<string, number>,
) {
  return products.map((p) => ({ ...p, stock: stock.get(p.id) ?? 0 }));
}

export async function getProducts(
  opts: {
    q?: string;
    category?: string;
    brand?: string;
    sort?: ProductSort;
  } = {},
) {
  const where: Prisma.ProductWhereInput = { published: true };
  if (opts.category) where.category = { slug: opts.category, visible: true };
  if (opts.brand) where.brand = opts.brand;
  if (opts.q) {
    where.OR = [
      { name: { contains: opts.q, mode: "insensitive" } },
      { shortDescription: { contains: opts.q, mode: "insensitive" } },
      { brand: { contains: opts.q, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    opts.sort === "price-asc"
      ? [{ priceCents: "asc" }]
      : opts.sort === "price-desc"
        ? [{ priceCents: "desc" }]
        : opts.sort === "newest"
          ? [{ createdAt: "desc" }]
          : [{ featured: "desc" }, { createdAt: "desc" }];

  const products = await prisma.product.findMany({
    where,
    orderBy,
    include: { category: true },
  });
  const stock = await availableStockByProduct(products.map((p) => p.id));
  return withStock(products, stock);
}

export async function getFeaturedProducts(limit = 4) {
  const products = await prisma.product.findMany({
    where: { published: true, featured: true },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { category: true },
  });
  const stock = await availableStockByProduct(products.map((p) => p.id));
  return withStock(products, stock);
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: { category: true },
  });
  if (!product || !product.published) return null;
  const stock = await availableStockByProduct([product.id]);
  return { ...product, stock: stock.get(product.id) ?? 0 };
}
