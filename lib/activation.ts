import { prisma } from "@/lib/db";
import { sendActivationReplyEmail } from "@/lib/mailer";
import { cleanConfirmationId } from "@/lib/delivery";
import { getFreeCheckHours } from "@/lib/warranty-claims";
import { checkPeriod } from "@/lib/warranty-claim-shared";

export type ResolveActivationResult =
  | { ok: true; orderNumber: string; message: string }
  | { ok: false; orderNumber: string | null; error: string };

/**
 * Answer an open phone activation request (admin, already authorized):
 * - send: store the Confirmation ID and email it to the customer.
 * - reject: we couldn't create one; the note (required) says why.
 */
export async function resolveActivation(opts: {
  requestId: string;
  action: string;
  confirmationId: string;
  note: string;
  adminEmail: string | null;
}): Promise<ResolveActivationResult> {
  const note = opts.note.trim().slice(0, 1000);
  if (opts.action !== "send" && opts.action !== "reject") {
    return { ok: false, orderNumber: null, error: "Choose what to do." };
  }
  const req = await prisma.activationRequest.findUnique({
    where: { id: opts.requestId },
    include: { key: { include: { orderItem: { include: { order: true } } } } },
  });
  const item = req?.key.orderItem;
  if (!req || !item) return { ok: false, orderNumber: null, error: "Request not found." };
  const order = item.order;
  if (req.status !== "OPEN") {
    return { ok: false, orderNumber: order.orderNumber, error: "This request was already answered." };
  }

  let confirmationId: string | null = null;
  if (opts.action === "send") {
    confirmationId = cleanConfirmationId(opts.confirmationId);
    if (!confirmationId) {
      return {
        ok: false,
        orderNumber: order.orderNumber,
        error: "A Confirmation ID has 48 digits (8 groups of 6). Check it and try again.",
      };
    }
  } else if (!note) {
    return { ok: false, orderNumber: order.orderNumber, error: "Tell the customer why (it's emailed to them)." };
  }

  // Only the first answer wins (two admins, or a double click).
  const updated = await prisma.activationRequest.updateMany({
    where: { id: req.id, status: "OPEN" },
    data: {
      status: confirmationId ? "DONE" : "REJECTED",
      confirmationId,
      note: note || null,
      resolvedAt: new Date(),
      resolvedBy: opts.adminEmail,
    },
  });
  if (updated.count === 0) {
    return { ok: false, orderNumber: order.orderNumber, error: "This request was already answered." };
  }

  const hours = await getFreeCheckHours();
  let emailNote = "";
  try {
    await sendActivationReplyEmail(order.email, {
      orderNumber: order.orderNumber,
      productName: item.productName,
      installationId: req.installationId,
      confirmationId,
      note: note || null,
      freeCheck: hours > 0 ? checkPeriod(hours) : null,
    });
  } catch (err) {
    console.error("[activation] reply email failed", err);
    emailNote = ` The email to ${order.email} failed, so contact them another way.`;
  }
  return {
    ok: true,
    orderNumber: order.orderNumber,
    message: (confirmationId ? "Confirmation ID sent." : "Reply sent.") + emailNote,
  };
}
