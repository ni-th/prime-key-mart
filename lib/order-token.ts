import crypto from "node:crypto";

/**
 * A short HMAC that lets a guest view their own freshly-placed order (on the
 * success page) without an account. Not a substitute for auth - it only grants
 * read access to one order number.
 */
function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

export function signOrderToken(orderNumber: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(`order:${orderNumber}`)
    .digest("base64url");
}

export function verifyOrderToken(orderNumber: string, token: string | null): boolean {
  if (!token) return false;
  const expected = signOrderToken(orderNumber);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
