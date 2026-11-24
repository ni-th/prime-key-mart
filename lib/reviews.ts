import { prisma } from "@/lib/db";
import type { OrderReviewItem, RatingSummary, ReviewStatus } from "@/lib/review-shared";

/** "Nimal Perera" -> "Nimal P."; falls back to the part of the email before @. */
export function publicAuthorName(customerName: string | null, email: string): string {
  const parts = (customerName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return email.split("@")[0].slice(0, 1).toUpperCase() + "***";
  const first = parts[0].slice(0, 30);
  const last = parts.length > 1 ? ` ${parts[parts.length - 1][0].toUpperCase()}.` : "";
  return `${first}${last}`;
}

/** Published reviews of a product, newest first, plus the rating summary. */
export async function getProductReviews(productId: string, take = 20) {
  const [reviews, agg] = await Promise.all([
    prisma.productReview.findMany({
      where: { productId, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        authorName: true,
        rating: true,
        title: true,
        body: true,
        adminReply: true,
        createdAt: true,
      },
    }),
    prisma.productReview.aggregate({
      where: { productId, status: "APPROVED" },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);
  const summary: RatingSummary = { average: agg._avg.rating ?? 0, count: agg._count._all };
  return { reviews, summary };
}

/** Rating summary per product (published reviews only), for product cards. */
export async function ratingSummaries(productIds: string[]): Promise<Map<string, RatingSummary>> {
  if (productIds.length === 0) return new Map();
  const groups = await prisma.productReview.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds }, status: "APPROVED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map(
    groups.map((g) => [g.productId, { average: g._avg.rating ?? 0, count: g._count._all }]),
  );
}

/**
 * The products in a delivered order, each with this customer's review (one
 * per product per email, whichever order it was written from). Only for
 * someone already proven to own the order.
 */
export async function orderReviewItems(order: {
  status: string;
  email: string;
  items: { productId: string; productName: string }[];
}): Promise<OrderReviewItem[]> {
  if (order.status !== "FULFILLED") return [];
  const ids = [...new Set(order.items.map((i) => i.productId))];
  const [products, reviews] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true, published: true } }),
    prisma.productReview.findMany({
      where: { productId: { in: ids }, email: order.email.toLowerCase() },
      select: { productId: true, rating: true, title: true, body: true, status: true, adminReply: true },
    }),
  ]);
  const product = new Map(products.map((p) => [p.id, p]));
  const review = new Map(reviews.map((r) => [r.productId, r]));
  return ids
    .filter((id) => product.get(id)?.published) // can't review what the shop no longer sells
    .map((id) => {
      const r = review.get(id);
      return {
        productId: id,
        productName: order.items.find((i) => i.productId === id)!.productName,
        productSlug: product.get(id)!.slug,
        review: r ? { ...r, status: r.status as ReviewStatus } : null,
      };
    });
}
