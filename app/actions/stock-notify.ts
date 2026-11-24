"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { isEmailBlocked } from "@/lib/moderation";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  productId: z.string().min(1).max(64),
  email: z.email().max(254),
});

export type NotifyState =
  | { status: "idle" }
  | { status: "subscribed"; email: string }
  | { status: "error"; message: string };

/** Sign-ups per visitor (IP) per hour. */
const IP_LIMIT = 10;
/** Sign-ups per email address per day, so one address can't be signed up to everything. */
const EMAIL_LIMIT = 5;

/**
 * "Email me when it's back in stock". Only for published products that are
 * out of stock right now. Signing up twice is harmless: it re-arms the same row.
 * The email itself is sent by notifyBackInStock (lib/restock.ts) on restock.
 */
export async function subscribeBackInStock(
  _prev: NotifyState,
  formData: FormData,
): Promise<NotifyState> {
  const parsed = schema.safeParse({
    productId: formData.get("productId"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { status: "error", message: "Enter a valid email address." };
  const { productId } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  const ip = await clientIp();
  if (!(await rateLimit(`restock-ip:${ip}`, IP_LIMIT, 3600))) {
    return { status: "error", message: "Too many sign-ups. Please try again in an hour." };
  }
  if (!(await rateLimit(`restock-email:${email}`, EMAIL_LIMIT, 24 * 3600))) {
    return { status: "error", message: "This email has had too many sign-ups today. Please try again tomorrow." };
  }
  // Same answer as success: don't reveal which addresses are blocked.
  if (await isEmailBlocked(email)) return { status: "subscribed", email };

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { published: true },
  });
  if (!product?.published) return { status: "error", message: "This product isn't available." };

  const stock = await prisma.licenseKey.count({ where: { productId, status: "AVAILABLE" } });
  if (stock > 0) {
    return { status: "error", message: "Good news: it's in stock right now. Refresh the page to buy it." };
  }

  await prisma.stockNotification.upsert({
    where: { productId_email: { productId, email } },
    create: { productId, email },
    update: { notifiedAt: null, createdAt: new Date() },
  });
  return { status: "subscribed", email };
}
