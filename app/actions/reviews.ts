"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin";
import { canViewOrder, getOrderByNumber } from "@/lib/orders";
import { rateLimit } from "@/lib/rate-limit";
import { sendAlert } from "@/lib/alerts";
import { publicAuthorName } from "@/lib/reviews";
import {
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  REVIEW_REPLY_MAX,
  REVIEW_TITLE_MAX,
  type ReviewStatus,
} from "@/lib/review-shared";

export type ReviewResult = { ok: true; message: string; status?: ReviewStatus } | { ok: false; error: string };

const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const reviewSchema = z.object({
  orderNumber: z.string().trim().min(3).max(40),
  token: z.string().max(200).nullish(),
  productId: z.string().min(1).max(64),
  rating: z.number().int().min(1, "Pick a star rating").max(5, "Pick a star rating"),
  title: z.string().trim().max(REVIEW_TITLE_MAX, `Keep the title under ${REVIEW_TITLE_MAX} characters`),
  body: z
    .string()
    .trim()
    .min(REVIEW_BODY_MIN, `Write at least ${REVIEW_BODY_MIN} characters`)
    .max(REVIEW_BODY_MAX, `Keep it under ${REVIEW_BODY_MAX} characters`),
});

/**
 * Customer: write or edit their review of a product in a delivered order.
 * Proof of purchase is the order (private link or signed-in owner). The review
 * waits for an admin's approval before it's shown; an edit waits again.
 */
export async function saveReview(input: {
  orderNumber: string;
  token?: string | null;
  productId: string;
  rating: number;
  title: string;
  body: string;
}): Promise<ReviewResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;

  const order = await getOrderByNumber(d.orderNumber);
  const allowed =
    order &&
    (canViewOrder(order, { token: d.token ?? null, orderNumber: d.orderNumber }) ||
      canViewOrder(order, { session: await auth(), orderNumber: d.orderNumber }));
  if (!order || !allowed) return { ok: false, error: "We couldn't find that order." };
  if (order.status !== "FULFILLED") return { ok: false, error: "You can review products once your order is delivered." };

  const item = order.items.find((i) => i.productId === d.productId);
  if (!item) return { ok: false, error: "That product isn't part of this order." };
  const product = await prisma.product.findUnique({
    where: { id: d.productId },
    select: { published: true, name: true, slug: true },
  });
  if (!product?.published) return { ok: false, error: "This product can't be reviewed any more." };

  if (!(await rateLimit(`review:${order.id}`, 10, 24 * 3600))) {
    return { ok: false, error: "Too many changes today. Please try again tomorrow." };
  }

  const email = order.email.toLowerCase();
  const title = d.title || null;
  const existing = await prisma.productReview.findUnique({
    where: { productId_email: { productId: d.productId, email } },
    select: { rating: true, title: true, body: true, status: true },
  });
  if (existing && existing.rating === d.rating && existing.title === title && existing.body === d.body) {
    return { ok: true, message: "No changes to save.", status: existing.status as ReviewStatus };
  }

  const data = {
    orderItemId: item.id,
    authorName: publicAuthorName(order.customerName, email),
    rating: d.rating,
    title,
    body: d.body,
    status: "PENDING",
  };
  await prisma.productReview.upsert({
    where: { productId_email: { productId: d.productId, email } },
    create: { productId: d.productId, email, ...data },
    update: data,
  });

  // An edit of a published review hides it until re-approved: refresh the page.
  if (existing?.status === "APPROVED") revalidateProduct(product.slug);
  revalidatePath("/admin/reviews");

  after(() =>
    sendAlert({
      type: "NEW_REVIEW",
      subject: `New review to approve: ${product.name} (${d.rating}/5)`,
      lines: [
        `${data.authorName} ${existing ? "edited their review of" : "reviewed"} ${product.name}: ${"★".repeat(d.rating)}${"☆".repeat(5 - d.rating)}`,
        ...(title ? [``, title] : []),
        ``,
        d.body.length > 300 ? `${d.body.slice(0, 300)}...` : d.body,
        ``,
        `Approve or hide it: ${SITE_URL}/admin/reviews`,
      ],
      // A busy day sends one email an hour, not one per review.
      dedupeKey: "review:new",
      cooldownHours: 1,
    }),
  );

  return {
    ok: true,
    status: "PENDING",
    message: existing
      ? "Thanks! Your updated review will appear once we've checked it."
      : "Thanks for your review! It will appear on the product page once we've checked it.",
  };
}

function revalidateProduct(slug: string) {
  revalidatePath(`/products/${slug}`);
  revalidatePath("/products");
  revalidatePath("/");
}

// --- Admin ------------------------------------------------------------------

async function reviewProductSlug(id: string) {
  const r = await prisma.productReview.findUnique({
    where: { id },
    select: { product: { select: { slug: true } } },
  });
  return r?.product.slug ?? null;
}

/** Admin: approve (show) or reject (hide) a review. */
export async function setReviewStatus(id: string, status: "APPROVED" | "REJECTED"): Promise<ReviewResult> {
  if (!(await getAdminSession())) return { ok: false, error: "Not authorized." };
  const slug = await reviewProductSlug(id);
  if (!slug) return { ok: false, error: "That review no longer exists." };
  await prisma.productReview.update({ where: { id }, data: { status } });
  revalidateProduct(slug);
  revalidatePath("/admin/reviews");
  return { ok: true, message: status === "APPROVED" ? "Review published." : "Review hidden." };
}

/** Admin: public reply under a review (empty removes it). */
export async function replyToReview(id: string, reply: string): Promise<ReviewResult> {
  if (!(await getAdminSession())) return { ok: false, error: "Not authorized." };
  const text = reply.trim();
  if (text.length > REVIEW_REPLY_MAX) {
    return { ok: false, error: `Keep the reply under ${REVIEW_REPLY_MAX} characters.` };
  }
  const slug = await reviewProductSlug(id);
  if (!slug) return { ok: false, error: "That review no longer exists." };
  await prisma.productReview.update({
    where: { id },
    data: { adminReply: text || null, repliedAt: text ? new Date() : null },
  });
  revalidateProduct(slug);
  revalidatePath("/admin/reviews");
  return { ok: true, message: text ? "Reply saved." : "Reply removed." };
}

/** Admin: delete a review for good (spam). The customer can write a new one. */
export async function deleteReview(id: string): Promise<ReviewResult> {
  if (!(await getAdminSession())) return { ok: false, error: "Not authorized." };
  const slug = await reviewProductSlug(id);
  if (!slug) return { ok: true, message: "Review deleted." };
  await prisma.productReview.delete({ where: { id } });
  revalidateProduct(slug);
  revalidatePath("/admin/reviews");
  return { ok: true, message: "Review deleted." };
}
