import crypto from "node:crypto";
import { prisma } from "@/lib/db";

/** How long a reset link works. */
export const RESET_TTL_MINUTES = 30;
/** Don't send another link to the same account within this window. */
const RESEND_COOLDOWN_SECONDS = 60;
/** Cap on links per account per hour (stops inbox flooding / Gmail quota burn). */
const MAX_PER_HOUR = 3;

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Create a reset token for a user, or return null if they've asked too often.
 * The raw token goes only into the emailed link; the DB keeps its hash.
 */
export async function createPasswordResetToken(userId: string): Promise<string | null> {
  const hourAgo = new Date(Date.now() - 60 * 60_000);
  const recent = await prisma.passwordResetToken.findMany({
    where: { userId, createdAt: { gt: hourAgo } },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  if (recent.length >= MAX_PER_HOUR) return null;
  if (
    recent[0] &&
    Date.now() - recent[0].createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000
  ) {
    return null;
  }

  const raw = crypto.randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
    },
  });
  return raw;
}

/** The user a token belongs to, if it's unused, unexpired and the account is usable. */
export async function findValidResetToken(raw: string | null | undefined) {
  if (!raw || raw.length > 200) return null;
  const token = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: { select: { id: true, email: true, suspended: true } } },
  });
  if (!token || token.usedAt || token.expiresAt < new Date()) return null;
  if (token.user.suspended) return null;
  return token;
}

/**
 * Atomically mark a token used and set the new password hash. Also burns every
 * other outstanding link for the account. Returns false if the token was
 * already used (e.g. the form was submitted twice).
 */
export async function consumeResetToken(
  tokenId: string,
  userId: string,
  passwordHash: string,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.passwordResetToken.updateMany({
      where: { id: tokenId, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (count === 0) return false;

    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await tx.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    return true;
  });
}
