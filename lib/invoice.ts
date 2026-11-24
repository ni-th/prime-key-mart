import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Invoices (bills) for paid orders.
 *
 * Numbers are sequential per year (INV-2026-000123) and never reused. An order
 * gets its number when it is paid (lib/inventory.ts); orders paid before
 * invoices existed get one on their first download. Both paths lock the order
 * row and bump the year's counter in the same transaction, so there are no
 * duplicates and no gaps.
 *
 * The bill never contains license keys or account passwords.
 */

/** Dates on bills are Sri Lanka dates (the business is in Sri Lanka). */
export const INVOICE_TIME_ZONE = "Asia/Colombo";

/** Statuses an order can have once money was taken. */
const PAID_STATUSES = new Set(["PAID", "FULFILLED", "REFUNDED"]);

export function hasInvoice(order: { status: string; paidAt: Date | null }): boolean {
  return order.paidAt !== null && PAID_STATUSES.has(order.status);
}

function invoiceYear(paidAt: Date): number {
  return Number(new Intl.DateTimeFormat("en", { timeZone: INVOICE_TIME_ZONE, year: "numeric" }).format(paidAt));
}

export function formatInvoiceNumber(year: number, seq: number): string {
  return `INV-${year}-${String(seq).padStart(6, "0")}`;
}

/**
 * Give the order its invoice number if it has none. The caller must hold the
 * order's row lock (SELECT ... FOR UPDATE) inside `tx`.
 */
export async function assignInvoiceNumber(
  tx: Prisma.TransactionClient,
  order: { id: string; invoiceNumber: string | null },
  paidAt: Date,
): Promise<string> {
  if (order.invoiceNumber) return order.invoiceNumber;
  const year = invoiceYear(paidAt);
  // Atomic increment: concurrent payments each get their own number.
  const [{ last }] = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "InvoiceCounter" ("year", "last") VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "last" = "InvoiceCounter"."last" + 1
    RETURNING "last"`;
  const invoiceNumber = formatInvoiceNumber(year, last);
  await tx.order.update({ where: { id: order.id }, data: { invoiceNumber } });
  return invoiceNumber;
}

/** The order's invoice number, assigning one now if needed. Null if unpaid. */
export async function ensureInvoiceNumber(orderId: string): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, paidAt: true, invoiceNumber: true },
    });
    if (!order || !hasInvoice(order) || !order.paidAt) return null;
    return assignInvoiceNumber(tx, order, order.paidAt);
  });
}

/* ---------- What goes on the bill ---------- */

export type InvoiceLine = {
  description: string;
  /** Second line under the description (sale name, warranty). */
  details: string[];
  quantity: number;
  /** Price per unit before any sale. */
  unitCents: number;
  /** Sale discount for the whole line (positive number). */
  discountCents: number;
  /** Warranty fee for the whole line. */
  warrantyCents: number;
  lineTotalCents: number;
};

export type InvoiceRefund = { description: string; date: Date; cents: number };

export type InvoiceData = {
  invoiceNumber: string;
  orderNumber: string;
  /** Upper-case currency code, e.g. "LKR". */
  currency: string;
  paidAt: Date;
  paymentRef: string | null;
  customer: { name: string | null; email: string; phone: string | null; country: string | null };
  lines: InvoiceLine[];
  /** Sum of list prices x quantity. */
  subtotalCents: number;
  discountCents: number;
  warrantyCents: number;
  totalCents: number;
  refunds: InvoiceRefund[];
  refundedCents: number;
};

function warrantyDetail(name: string | null, days: number | null): string | null {
  if (!name) return null;
  const label = /warranty/i.test(name) ? name : `${name} warranty`;
  const length =
    days === null
      ? "lifetime"
      : days % 365 === 0
        ? `${days / 365} year${days === 365 ? "" : "s"}`
        : `${days} days`;
  // "Lifetime warranty", not "Lifetime warranty (lifetime)".
  return label.toLowerCase().includes(length) ? label : `${label} (${length})`;
}

/** Everything the PDF needs, or null when the order has no bill (unpaid). */
export async function loadInvoice(orderNumber: string): Promise<InvoiceData | null> {
  const found = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } });
  if (!found) return null;
  const invoiceNumber = await ensureInvoiceNumber(found.id);
  if (!invoiceNumber) return null;

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: found.id },
    include: {
      items: {
        orderBy: { id: "asc" },
        include: {
          warrantyClaims: {
            where: { status: "REFUNDED", refundCents: { gt: 0 } },
            orderBy: { resolvedAt: "asc" },
            select: { refundCents: true, resolvedAt: true, createdAt: true },
          },
        },
      },
    },
  });

  const lines: InvoiceLine[] = order.items.map((item) => {
    const list = Math.max(item.listPriceCents ?? item.unitPriceCents, item.unitPriceCents);
    const discountCents = (list - item.unitPriceCents) * item.quantity;
    const warrantyCents = (item.warrantyCents ?? 0) * item.quantity;
    const details: string[] = [];
    if (discountCents > 0) {
      const pct = item.discountPercent ? ` (${Math.round(item.discountPercent)}% off)` : "";
      details.push(`${item.discountName ?? "Sale"}${pct}`);
    }
    const w = warrantyDetail(item.warrantyName, item.warrantyDays);
    if (w) details.push(item.warrantyCents ? w : `${w}, included`);
    return {
      description: item.productName,
      details,
      quantity: item.quantity,
      unitCents: list,
      discountCents,
      warrantyCents,
      lineTotalCents: item.unitPriceCents * item.quantity + warrantyCents,
    };
  });

  // Refunds: single keys refunded through a claim, then a whole-order refund
  // for whatever was not already refunded.
  const refunds: InvoiceRefund[] = [];
  for (const item of order.items) {
    for (const claim of item.warrantyClaims) {
      refunds.push({
        description: `Refund: 1 key, ${item.productName}`,
        date: claim.resolvedAt ?? claim.createdAt,
        cents: claim.refundCents ?? 0,
      });
    }
  }
  refunds.sort((a, b) => a.date.getTime() - b.date.getTime());
  const keyRefunds = refunds.reduce((s, r) => s + r.cents, 0);
  if (order.status === "REFUNDED" && order.totalCents - keyRefunds > 0) {
    refunds.push({
      description: keyRefunds > 0 ? "Refund: rest of the order" : "Refund: whole order",
      date: order.refundedAt ?? order.updatedAt,
      cents: order.totalCents - keyRefunds,
    });
  }

  return {
    invoiceNumber,
    orderNumber: order.orderNumber,
    currency: order.currency.toUpperCase(),
    paidAt: order.paidAt!,
    paymentRef: order.stripePaymentIntentId,
    customer: {
      name: order.customerName,
      email: order.email,
      phone: order.customerPhone,
      country: order.customerCountry,
    },
    lines,
    subtotalCents: lines.reduce((s, l) => s + l.unitCents * l.quantity, 0),
    discountCents: lines.reduce((s, l) => s + l.discountCents, 0),
    warrantyCents: lines.reduce((s, l) => s + l.warrantyCents, 0),
    totalCents: order.totalCents,
    refunds,
    refundedCents: refunds.reduce((s, r) => s + r.cents, 0),
  };
}
