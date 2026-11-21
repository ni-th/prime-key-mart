import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendAdminAlertEmail, sendOrderKeysEmail } from "@/lib/mailer";

/** How long an unpaid checkout may hold its keys before they go back to stock. */
export const RESERVATION_TTL_MINUTES = 30;

export class InsufficientStockError extends Error {
  constructor(public readonly productName: string) {
    super(`Not enough stock for ${productName}`);
    this.name = "InsufficientStockError";
  }
}

type Tx = Prisma.TransactionClient;

/**
 * Atomically move up to `need` AVAILABLE keys of a product to RESERVED for one
 * order item. `FOR UPDATE SKIP LOCKED` means two concurrent buyers never wait on
 * (or fight over) the same row - each simply takes the next free key.
 * Returns how many keys were actually claimed.
 */
async function claimKeys(
  tx: Tx,
  item: { id: string; productId: string },
  need: number,
): Promise<number> {
  if (need <= 0) return 0;
  return tx.$executeRaw`
    UPDATE "LicenseKey"
       SET "status" = 'RESERVED', "orderItemId" = ${item.id}, "reservedAt" = NOW()
     WHERE "id" IN (
       SELECT "id" FROM "LicenseKey"
        WHERE "productId" = ${item.productId} AND "status" = 'AVAILABLE'
        ORDER BY "createdAt" ASC
        LIMIT ${need}
        FOR UPDATE SKIP LOCKED
     )`;
}

/** How many more keys each item of an order still needs (RESERVED/SOLD count as held). */
async function itemsWithShortfall(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  const result = [];
  for (const item of items) {
    const held = await tx.licenseKey.count({
      where: { orderItemId: item.id, status: { in: ["RESERVED", "SOLD"] } },
    });
    result.push({ item, need: item.quantity - held });
  }
  return result;
}

/**
 * Reserve AVAILABLE license keys for every line of an order. Runs in a single
 * transaction: if any line is short on stock, nothing is reserved and an
 * InsufficientStockError is thrown. Idempotent - re-running tops up to the
 * required quantity rather than double-reserving.
 */
export async function reserveKeysForOrder(orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const { item, need } of await itemsWithShortfall(tx, orderId)) {
      if (need <= 0) continue;
      const claimed = await claimKeys(tx, item, need);
      if (claimed < need) throw new InsufficientStockError(item.productName);
    }
  });
}

export type FulfillOutcome =
  /** Keys are SOLD and the keys email was sent (now or earlier). */
  | { status: "FULFILLED"; orderNumber: string; alreadyFulfilled: boolean }
  /** Payment is recorded but there were not enough keys - needs an admin. */
  | { status: "PAID"; orderNumber: string; missing: string[] }
  /** Order was refunded; nothing was changed. */
  | { status: "REFUNDED"; orderNumber: string };

/**
 * Called when a payment is confirmed. Idempotent, so it is safe for webhook
 * retries, the mock payment flow and the admin "deliver keys" button.
 *
 * Normally the order is PENDING with its keys already RESERVED. But a payment
 * can also arrive for an order whose reservation was already released (it
 * expired, or a failure notification came first). In that case we try to
 * reserve fresh keys; if stock has run out we never "fulfil" an order with no
 * keys - the order is parked as PAID and an admin is alerted to deliver later
 * or refund.
 */
export async function fulfillOrder(
  orderId: string,
  opts: { paymentRef?: string | null } = {},
): Promise<FulfillOutcome> {
  const result = await prisma.$transaction(async (tx): Promise<FulfillOutcome> => {
    // Row lock: serialises against a concurrent release/expiry or a duplicate webhook.
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error(`Order ${orderId} not found`);

    if (order.status === "FULFILLED") {
      return { status: "FULFILLED", orderNumber: order.orderNumber, alreadyFulfilled: true };
    }
    if (order.status === "REFUNDED") {
      return { status: "REFUNDED", orderNumber: order.orderNumber };
    }

    // Top up any line that lost its reservation (no-op for a normal PENDING order).
    const missing: string[] = [];
    for (const { item, need } of await itemsWithShortfall(tx, orderId)) {
      if (need <= 0) continue;
      const claimed = await claimKeys(tx, item, need);
      if (claimed < need) missing.push(`${item.productName} (${need - claimed} short)`);
    }

    const paidAt = order.paidAt ?? new Date();
    const paymentRef = opts.paymentRef ?? order.stripePaymentIntentId;

    if (missing.length > 0) {
      // Keep whatever we could reserve - it stays held for this paid customer.
      await tx.order.update({
        where: { id: orderId },
        data: { status: "PAID", paidAt, stripePaymentIntentId: paymentRef },
      });
      return { status: "PAID", orderNumber: order.orderNumber, missing };
    }

    const items = await tx.orderItem.findMany({ where: { orderId }, select: { id: true } });
    await tx.licenseKey.updateMany({
      where: { orderItemId: { in: items.map((i) => i.id) }, status: "RESERVED" },
      data: { status: "SOLD", soldAt: new Date() },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { status: "FULFILLED", paidAt, stripePaymentIntentId: paymentRef },
    });
    return { status: "FULFILLED", orderNumber: order.orderNumber, alreadyFulfilled: false };
  });

  if (result.status === "FULFILLED" && !result.alreadyFulfilled) {
    try {
      await sendOrderKeysEmail(result.orderNumber);
    } catch (err) {
      console.error(`[fulfillOrder] email failed for ${result.orderNumber}`, err);
    }
  } else if (result.status === "PAID") {
    console.error(
      `[fulfillOrder] ${result.orderNumber} is paid but short on stock: ${result.missing.join(", ")}`,
    );
    try {
      await sendAdminAlertEmail({
        subject: `Action needed: order ${result.orderNumber} paid but out of stock`,
        lines: [
          `Order ${result.orderNumber} was paid${opts.paymentRef ? ` (payment ${opts.paymentRef})` : ""}, but there were not enough keys to deliver it.`,
          ``,
          `Missing: ${result.missing.join(", ")}`,
          ``,
          `Add keys and use "Mark as paid & deliver keys" on the order, or refund the customer through PayHere.`,
        ],
      });
    } catch (err) {
      console.error(`[fulfillOrder] admin alert failed for ${result.orderNumber}`, err);
    }
  }
  return result;
}

/**
 * Release a PENDING order's reserved keys back to the pool. Does nothing for
 * any other status - in particular a PAID order (payment confirmed, waiting on
 * stock) must never lose its keys to a late failure/cancel notification.
 * Returns true if the order was released by this call.
 */
export async function releaseOrderReservation(
  orderId: string,
  finalStatus: "EXPIRED" | "FAILED" = "EXPIRED",
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    // Conditional flip doubles as the lock: a concurrent fulfillOrder holding
    // the row makes this wait, then see a non-PENDING status and do nothing.
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: finalStatus },
    });
    if (count === 0) return false;

    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: { id: true },
    });
    await tx.licenseKey.updateMany({
      where: {
        orderItemId: { in: items.map((i) => i.id) },
        status: "RESERVED",
      },
      data: { status: "AVAILABLE", orderItemId: null, reservedAt: null },
    });
    return true;
  });
}

/**
 * Expire checkouts that were never paid for. Called lazily at the start of
 * every checkout so abandoned orders can't hold stock forever (no cron needed).
 * If the customer does pay after this, fulfillOrder re-reserves keys.
 */
export async function expireStaleReservations(limit = 50): Promise<number> {
  const cutoff = new Date(Date.now() - RESERVATION_TTL_MINUTES * 60_000);
  const stale = await prisma.order.findMany({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let released = 0;
  for (const { id } of stale) {
    if (await releaseOrderReservation(id, "EXPIRED")) released++;
  }
  if (released > 0) console.log(`[inventory] expired ${released} stale reservation(s)`);
  return released;
}
