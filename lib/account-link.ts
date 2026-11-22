import crypto from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Linking guest orders to an account.
 *
 * Accounts are created without checking the email, so we never hand someone
 * the orders (and keys) of an email address just because they typed it at
 * sign-up. First they confirm the address through an emailed link; after that
 * guest orders with that email are linked automatically.
 */

/** How long a "confirm your email" link works. */
export const LINK_TTL_HOURS = 24;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(`link-orders:${payload}`).digest("base64url");
}

/** A token for /account/link-orders: proves the holder can read this inbox. */
export function signLinkToken(userId: string, email: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + LINK_TTL_HOURS * 3600;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(`${payload}.${email.toLowerCase()}`)}`;
}

/** The account a token claims to be for (not yet verified). */
export function linkTokenUserId(token: string): string | null {
  const [userId, expRaw, mac] = token.split(".");
  return userId && expRaw && mac ? userId : null;
}

/** True when the token is genuine, unexpired and was issued for this email. */
export function verifyLinkToken(token: string, email: string): boolean {
  const [userId, expRaw, mac] = token.split(".");
  if (!userId || !expRaw || !mac) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const expected = Buffer.from(sign(`${userId}.${expRaw}.${email.toLowerCase()}`));
  const given = Buffer.from(mac);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/** Guest orders (no account) placed with this email. */
export function guestOrdersWhere(email: string) {
  return { userId: null, email: { equals: email, mode: "insensitive" as const } };
}

export async function countGuestOrders(email: string): Promise<number> {
  return prisma.order.count({ where: guestOrdersWhere(email) });
}

/** Attach this email's guest orders to the account. Returns how many moved. */
export async function linkGuestOrders(userId: string, email: string): Promise<number> {
  const { count } = await prisma.order.updateMany({ where: guestOrdersWhere(email), data: { userId } });
  return count;
}

/**
 * On each account visit: if the email is already confirmed, quietly pick up
 * guest orders placed since (e.g. a purchase made while signed out).
 * Otherwise report how many are waiting for confirmation.
 */
export async function syncGuestOrders(user: {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
}): Promise<{ linked: number; waiting: number }> {
  const waiting = await countGuestOrders(user.email);
  if (waiting === 0) return { linked: 0, waiting: 0 };
  if (user.emailVerifiedAt) return { linked: await linkGuestOrders(user.id, user.email), waiting: 0 };
  return { linked: 0, waiting };
}
