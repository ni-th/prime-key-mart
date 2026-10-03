import { prisma } from "@/lib/db";

/** True if this email address has been blocked by an admin. */
export async function isEmailBlocked(email: string): Promise<boolean> {
  const hit = await prisma.blockedEmail.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true },
  });
  return Boolean(hit);
}

/**
 * Gate used at checkout: a blocked email, or a signed-in but suspended account,
 * cannot place orders. Returns a reason string when blocked, otherwise null.
 */
export async function checkoutBlockReason(
  email: string,
  userId?: string | null,
): Promise<string | null> {
  if (await isEmailBlocked(email)) {
    return "This email address can't be used for orders. Contact support.";
  }
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { suspended: true },
    });
    if (user?.suspended) {
      return "Your account is suspended. Contact support.";
    }
  }
  return null;
}
