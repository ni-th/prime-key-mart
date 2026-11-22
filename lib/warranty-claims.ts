import { ADMIN_COST_FIELDS, prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { queueStockCheck } from "@/lib/alerts";
import { sendWarrantyClaimResolvedEmail } from "@/lib/mailer";
import { getPricingSettings } from "@/lib/pricing";
import { asCurrency, convertCost } from "@/lib/profit";
import { warrantySummary } from "@/lib/warranty";
import type { ClaimStatus, WarrantyItemView } from "@/lib/warranty-claim-shared";

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

/**
 * The warranty section of an order for its owner: every delivered item that
 * came with a warranty, its keys (identified by their last characters) and
 * the latest claim on each key. Replaced keys are left out (the customer sees
 * the replacement instead).
 */
export async function warrantyViewForOrder(orderId: string): Promise<WarrantyItemView[]> {
  const items = await prisma.orderItem.findMany({
    where: { orderId, warrantyName: { not: null } },
    include: {
      licenseKeys: {
        where: { status: "SOLD", replacedAt: null },
        orderBy: { soldAt: "asc" },
      },
      warrantyClaims: { orderBy: { createdAt: "desc" } },
    },
  });

  return items.map((item) => ({
    itemId: item.id,
    productName: item.productName,
    warrantyName: item.warrantyName!,
    summary: warrantySummary(item) ?? item.warrantyName!,
    active: warrantyActive(item),
    keys: item.licenseKeys.map((k) => {
      const plain = decryptSecret({ ciphertext: k.secretCiphertext, iv: k.secretIv, authTag: k.secretAuthTag });
      const claim = item.warrantyClaims.find((c) => c.keyId === k.id);
      return {
        id: k.id,
        label: `...${plain.replace(/[^A-Za-z0-9]/g, "").slice(-5)}`,
        value: plain,
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

export type ResolveClaimResult =
  | { ok: true; orderNumber: string; message: string }
  | { ok: false; orderNumber: string | null; error: string };

/**
 * Close an open warranty claim (admin decision, already authorized by the caller):
 * - replace: sell a new key from stock to the same order line, mark the old
 *   one replaced and email the new key.
 * - refund: record it (the money is returned in PayHere separately).
 * - reject: not covered; the note explains why (required).
 * The note is emailed to the customer in every case.
 */
export async function resolveClaim(opts: {
  claimId: string;
  action: string;
  note: string;
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
        ? "Claim marked refunded. Remember to refund the payment in PayHere."
        : "Claim closed as not covered.";
  return emailNote
    ? { ok: false, orderNumber: order.orderNumber, error: done + emailNote }
    : { ok: true, orderNumber: order.orderNumber, message: done };
}
