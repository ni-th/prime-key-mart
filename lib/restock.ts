import { prisma } from "@/lib/db";
import { sendBackInStockEmail } from "@/lib/mailer";

/** Most emails sent per check; any left over go out on the next stock check. */
const MAX_PER_CHECK = 500;

/**
 * Emails everyone waiting on these products, now that they have stock.
 * Called from checkStockAlerts with the published products that are in stock.
 *
 * Each sign-up is claimed (notifiedAt set) before its email is sent, so two
 * checks running at once can't email the same person twice. A failed send
 * un-claims it so the next restock check tries again. Never throws.
 */
export async function notifyBackInStock(productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  try {
    const waiting = await prisma.stockNotification.findMany({
      where: { productId: { in: productIds }, notifiedAt: null },
      orderBy: { createdAt: "asc" },
      take: MAX_PER_CHECK,
      select: { id: true, email: true, product: { select: { name: true, slug: true } } },
    });

    for (const n of waiting) {
      const { count } = await prisma.stockNotification.updateMany({
        where: { id: n.id, notifiedAt: null },
        data: { notifiedAt: new Date() },
      });
      if (count === 0) continue; // another check got it first

      try {
        await sendBackInStockEmail(n.email, n.product);
      } catch (err) {
        console.error(`[restock] email to ${n.email} failed`, err);
        await prisma.stockNotification
          .update({ where: { id: n.id }, data: { notifiedAt: null } })
          .catch(() => {});
      }
    }
  } catch (err) {
    console.error("[restock] notifyBackInStock failed", err);
  }
}

/** People still waiting for each product (for admin). */
export async function waitingCount(productId: string): Promise<number> {
  return prisma.stockNotification.count({ where: { productId, notifiedAt: null } });
}
