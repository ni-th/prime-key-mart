import type { Prisma } from "@prisma/client";
import { ADMIN_COST_FIELDS, prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { queueStockCheck } from "@/lib/alerts";
import { sendWarrantyClaimResolvedEmail } from "@/lib/mailer";
import { getPricingSettings } from "@/lib/pricing";
import { asCurrency, convertCost } from "@/lib/profit";
import { warrantySummary } from "@/lib/warranty";
import { formatMoney } from "@/lib/money";
import type { ClaimStatus, KeyCover, OrderKeyItem } from "@/lib/warranty-claim-shared";

/** Covered right now: lifetime (no end) or not yet expired. */
export function warrantyActive(item: {
  warrantyName: string | null;
  warrantyDays: number | null;
  warrantyExpiresAt: Date | null;
}): boolean {
  if (!item.warrantyName) return false;
  if (item.warrantyDays === null) return true; // lifetime
  return item.warrantyExpiresAt !== null && item.warrantyExpiresAt > new Date();
}

/** Hours after delivery during which any key can be reported (store setting). */
export async function getFreeCheckHours(): Promise<number> {
  const row = await prisma.storeSettings.findUnique({ where: { id: "default" }, select: { freeCheckHours: true } });
  return row?.freeCheckHours ?? 24;
}

/**
 * Whether a key can be reported now. A paid warranty covers until its end
 * date; without one (or after it ends) every key still gets the free check
 * period counted from when that key was delivered. Whichever ends later wins.
 */
export function keyCover(
  item: { warrantyName: string | null; warrantyDays: number | null; warrantyExpiresAt: Date | null },
  soldAt: Date | null,
  freeCheckHours: number,
  now = new Date(),
): KeyCover | null {
  const free =
    soldAt && freeCheckHours > 0 ? new Date(soldAt.getTime() + freeCheckHours * 3_600_000) : null;
  const freeOpen = free !== null && free > now;
  if (warrantyActive(item)) {
    const ends = item.warrantyDays === null ? null : item.warrantyExpiresAt;
    // A short warranty can end before the free check (e.g. replacement key on day 6 of 7).
    if (ends && freeOpen && free > ends) return { kind: "FREE_CHECK", endsAt: free.toISOString() };
    return { kind: "WARRANTY", endsAt: ends ? ends.toISOString() : null };
  }
  return freeOpen ? { kind: "FREE_CHECK", endsAt: free.toISOString() } : null;
}

/**
 * The delivered keys of an order for its owner, one entry per product line,
 * with its warranty (if bought) and the latest claim on each key. Replaced
 * keys are left out (the customer sees the replacement instead). Only call
 * after checking the viewer may see the order: it contains the full keys.
 */
export async function orderKeysForOwner(orderId: string): Promise<OrderKeyItem[]> {
  return keyItems({ orderId });
}

/**
 * Every key a signed-in customer owns, across all their delivered orders,
 * newest order first. Same shape as an order page, so warranty claims work
 * the same way.
 */
export async function keysForUser(userId: string): Promise<OrderKeyItem[]> {
  return keyItems({ order: { userId, status: "FULFILLED" } });
}

async function keyItems(where: Prisma.OrderItemWhereInput): Promise<OrderKeyItem[]> {
  const freeHours = await getFreeCheckHours();
  const now = new Date();
  const items = await prisma.orderItem.findMany({
    where,
    orderBy: { order: { createdAt: "desc" } },
    include: {
      order: { select: { orderNumber: true, createdAt: true } },
      licenseKeys: {
        where: { status: "SOLD", replacedAt: null },
        orderBy: { soldAt: "asc" },
      },
      warrantyClaims: { orderBy: { createdAt: "desc" } },
    },
  });

  return items.map((item) => ({
    itemId: item.id,
    orderNumber: item.order.orderNumber,
    orderedAt: item.order.createdAt.toISOString(),
    productName: item.productName,
    warrantyName: item.warrantyName,
    summary: item.warrantyName ? (warrantySummary(item) ?? item.warrantyName) : null,
    active: warrantyActive(item),
    keys: item.licenseKeys.map((k) => {
      const plain = decryptSecret({ ciphertext: k.secretCiphertext, iv: k.secretIv, authTag: k.secretAuthTag });
      const claim = item.warrantyClaims.find((c) => c.keyId === k.id);
      return {
        id: k.id,
        label: `...${plain.replace(/[^A-Za-z0-9]/g, "").slice(-5)}`,
        value: plain,
        cover: keyCover(item, k.soldAt, freeHours, now),
        isReplacement: item.warrantyClaims.some((c) => c.replacementKeyId === k.id),
        claim: claim
          ? {
              status: claim.status as ClaimStatus,
              note: claim.resolutionNote,
              createdAt: claim.createdAt.toISOString(),
            }
          : null,
      };
    }),
  }));
}

/** What the customer paid for one key of this line: its price plus its warranty fee. */
export function perKeyPaidCents(item: { unitPriceCents: number; warrantyCents: number | null }): number {
  return item.unitPriceCents + (item.warrantyCents ?? 0);
}

export type ResolveClaimResult =
  | { ok: true; orderNumber: string; message: string }
  | { ok: false; orderNumber: string | null; error: string };

/**
 * Close an open warranty claim (admin decision, already authorized by the caller):
 * - replace: sell a new key from stock to the same order line, mark the old
 *   one replaced and email the new key.
 * - refund: record the amount refunded for this one key (the money is
 *   returned in PayHere separately). Defaults to what the key cost the
 *   customer (its price plus its warranty fee).
 * - reject: not covered; the note explains why (required).
 * The note is emailed to the customer in every case.
 */
export async function resolveClaim(opts: {
  claimId: string;
  action: string;
  note: string;
  /** Refund for this key in the order currency, e.g. "1250" or "12.50". Blank = full key price. */
  refundAmount?: string;
  adminEmail: string | null;
}): Promise<ResolveClaimResult> {
  const { claimId, action } = opts;
  const note = opts.note.trim().slice(0, 1000);
  if (!["replace", "refund", "reject"].includes(action)) return { ok: false, orderNumber: null, error: "Unknown action." };
  if (action === "reject" && note.length < 10) {
    return { ok: false, orderNumber: null, error: "Explain to the customer why the claim isn't covered." };
  }

  const claim = await prisma.warrantyClaim.findUnique({
    where: { id: claimId },
    include: { orderItem: { include: { order: true } } },
  });
  if (!claim) return { ok: false, orderNumber: null, error: "Claim not found." };
  if (claim.status !== "OPEN") return { ok: false, orderNumber: null, error: "This claim is already closed." };
  const { orderItem: item } = claim;
  const order = item.order;
  const keyPaidCents = perKeyPaidCents(item);
  let refundCents: number | null = null;
  if (action === "refund") {
    const raw = (opts.refundAmount ?? "").trim();
    if (raw === "") refundCents = keyPaidCents;
    else {
      const n = Number(raw.replace(/,/g, ""));
      if (!Number.isFinite(n) || n < 0) {
        return { ok: false, orderNumber: order.orderNumber, error: "Enter a valid refund amount." };
      }
      refundCents = Math.round(n * 100);
      if (refundCents > keyPaidCents) {
        return { ok: false, orderNumber: order.orderNumber, error: "That's more than the customer paid for this key." };
      }
    }
  }

  let newKey: string | null = null;
  if (action === "replace") {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      omit: ADMIN_COST_FIELDS.product,
    });
    const settings = await getPricingSettings();
    const currency = asCurrency(order.currency.toUpperCase());
    const costCents =
      product?.costCents != null
        ? convertCost(product.costCents, asCurrency(product.costCurrency), currency, settings.rate)
        : null;

    const result: { key?: string; error?: string } = await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction: never handle a claim twice.
      const fresh = await tx.warrantyClaim.updateMany({
        where: { id: claim.id, status: "OPEN" },
        data: { status: "REPLACED", resolvedAt: new Date(), resolvedBy: opts.adminEmail, resolutionNote: note || null },
      });
      if (fresh.count === 0) return { error: "This claim is already closed." };

      // Take the oldest available key of the same product (skip keys other
      // checkouts are locking right now).
      const rows = await tx.$queryRaw<{ id: string }[]>`
        UPDATE "LicenseKey"
           SET "status" = 'SOLD', "orderItemId" = ${item.id}, "soldAt" = NOW(), "reservedAt" = NULL
         WHERE "id" = (
           SELECT "id" FROM "LicenseKey"
            WHERE "productId" = ${item.productId} AND "status" = 'AVAILABLE'
            ORDER BY "createdAt" ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
         )
        RETURNING "id"`;
      const replacementId = rows[0]?.id;
      if (!replacementId) throw new Error("NO_STOCK");

      await tx.licenseKey.update({ where: { id: claim.keyId }, data: { replacedAt: new Date() } });
      await tx.warrantyClaim.update({
        where: { id: claim.id },
        data: { replacementKeyId: replacementId, replacementCostCents: costCents },
      });
      const k = await tx.licenseKey.findUniqueOrThrow({ where: { id: replacementId } });
      return { key: decryptSecret({ ciphertext: k.secretCiphertext, iv: k.secretIv, authTag: k.secretAuthTag }) };
    }).catch((err) => {
      if (err instanceof Error && err.message === "NO_STOCK") return { error: "NO_STOCK" as const };
      throw err;
    });

    if (!result.key) {
      return {
        ok: false,
        orderNumber: order.orderNumber,
        error:
          result.error === "NO_STOCK"
            ? `No ${item.productName} keys in stock. Add keys, then send the replacement (or refund instead).`
            : (result.error ?? "Couldn't replace the key."),
      };
    }
    newKey = result.key;
    queueStockCheck([item.productId]);
  } else {
    const updated = await prisma.warrantyClaim.updateMany({
      where: { id: claim.id, status: "OPEN" },
      data: {
        status: action === "refund" ? "REFUNDED" : "REJECTED",
        refundCents,
        resolvedAt: new Date(),
        resolvedBy: opts.adminEmail,
        resolutionNote: note || null,
      },
    });
    if (updated.count === 0) return { ok: false, orderNumber: order.orderNumber, error: "This claim is already closed." };
  }

  const outcome = action === "replace" ? "REPLACED" : action === "refund" ? "REFUNDED" : "REJECTED";
  let emailNote = "";
  try {
    await sendWarrantyClaimResolvedEmail(order.email, {
      orderNumber: order.orderNumber,
      productName: item.productName,
      outcome,
      newKey,
      refund: refundCents !== null ? formatMoney(refundCents, order.currency.toUpperCase()) : null,
      warrantyNote: warrantySummary(item),
      note: note || null,
    });
  } catch (err) {
    console.error("[warranty-claim] resolution email failed", err);
    emailNote = ` The email to ${order.email} failed, so contact them another way.`;
  }

  const done =
    outcome === "REPLACED"
      ? "Replacement key sent."
      : outcome === "REFUNDED"
        ? `Refund of ${formatMoney(refundCents ?? 0, order.currency.toUpperCase())} recorded. Remember to refund it in PayHere (partial refund).`
        : "Claim closed as not covered.";
  return emailNote
    ? { ok: false, orderNumber: order.orderNumber, error: done + emailNote }
    : { ok: true, orderNumber: order.orderNumber, message: done };
}
