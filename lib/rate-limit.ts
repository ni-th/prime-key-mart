import { headers } from "next/headers";
import { prisma } from "@/lib/db";

/**
 * Simple sliding-window rate limit stored in the database (works across
 * serverless instances, no Redis needed). Fine for low-volume, abuse-prone
 * endpoints like order lookup - not for high-traffic APIs.
 *
 * Returns true when the request is allowed (and counts it), false when the
 * key already made `limit` requests within `windowSeconds`.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const since = new Date(Date.now() - windowSeconds * 1000);
  const count = await prisma.rateLimitHit.count({ where: { key, createdAt: { gte: since } } });
  if (count >= limit) return false;
  await prisma.rateLimitHit.create({ data: { key } });

  // Housekeeping now and then: nothing needs hits older than a day.
  if (Math.random() < 0.02) {
    await prisma.rateLimitHit
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3_600_000) } } })
      .catch(() => {});
  }
  return true;
}

/** Best-effort client IP (Vercel sets x-forwarded-for). */
export async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    return (
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip")?.trim() ||
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

/** How many hits `key` has within the window (without counting a new one). */
export async function countHits(key: string, windowSeconds: number): Promise<number> {
  const since = new Date(Date.now() - windowSeconds * 1000);
  return prisma.rateLimitHit.count({ where: { key, createdAt: { gte: since } } });
}

/** Record one hit for each key (e.g. a failed attempt). */
export async function recordHits(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await prisma.rateLimitHit.createMany({ data: keys.map((key) => ({ key })) });
}
