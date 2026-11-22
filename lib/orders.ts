import crypto from "node:crypto";
import type { Session } from "next-auth";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { secretText } from "@/lib/delivery";
import { verifyOrderToken } from "@/lib/order-token";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateOrderNumber(): string {
  let body = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) body += ALPHABET[bytes[i] % ALPHABET.length];
  return `KM-${body}`;
}

export type OrderWithDetail = NonNullable<
  Awaited<ReturnType<typeof getOrderByNumber>>
>;

export function getOrderByNumber(orderNumber: string) {
  return prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: {
        include: { licenseKeys: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
}

export async function getUserOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { quantity: true } } },
  });
}

/** Full order detail, but only if it belongs to this user. */
export async function getUserOrderDetail(userId: string, orderNumber: string) {
  const order = await getOrderByNumber(orderNumber);
  if (!order || order.userId !== userId) return null;
  return order;
}

/** Verify a guest order by number + email (case-insensitive). */
export async function lookupGuestOrder(orderNumber: string, email: string) {
  const order = await getOrderByNumber(orderNumber.trim().toUpperCase());
  if (!order) return null;
  if (order.email.toLowerCase() !== email.trim().toLowerCase()) return null;
  return order;
}

type Order = { userId: string | null; email: string };

/** Can this requester see the order's keys? */
export function canViewOrder(
  order: Order,
  opts: { session?: Session | null; token?: string | null; orderNumber: string },
): boolean {
  const { session, token, orderNumber } = opts;
  // Admins can view any order - but only after passing 2FA this session.
  if (session?.user?.role === "ADMIN" && session.user.mfa) return true;
  if (order.userId && session?.user?.id === order.userId) return true;
  if (verifyOrderToken(orderNumber, token ?? null)) return true;
  return false;
}

/** Flatten an order's SOLD keys into a display list (decrypted). */
export function decryptOrderKeys(order: OrderWithDetail) {
  return order.items.map((item) => ({
    productName: item.productName,
    quantity: item.quantity,
    keys: item.licenseKeys
      // Keys replaced under warranty no longer count; the replacement does.
      .filter((k) => k.status === "SOLD" && !k.replacedAt)
      .map((k) =>
        secretText(
          decryptSecret({
            ciphertext: k.secretCiphertext,
            iv: k.secretIv,
            authTag: k.secretAuthTag,
          }),
        ),
      ),
  }));
}
