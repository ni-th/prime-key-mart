import { BRAND } from "@/lib/brand";
import { formatMoney } from "@/lib/money";
import { SITE_URL, renderEmail, type RenderedEmail, type Tone } from "@/lib/email/render";
import { ACTIVATION_REPLY_TIME, formatActivationId, parseSecret } from "@/lib/delivery";
import { orderInvoiceUrl, orderViewUrl } from "@/lib/order-token";

/**
 * One function per email. Each prepares the data for its Handlebars template
 * (emails/<name>.hbs + emails/<name>.text.hbs) and the subject line.
 * Preview them all in Admin -> Emails.
 */
export type EmailContent = RenderedEmail;

// --- Customer emails ---------------------------------------------------------------

/** A decrypted secret as the key templates expect it: a key string, or {username, password}. */
function emailKey(plain: string): string | { username: string; password: string } {
  const s = parseSecret(plain);
  return s.kind === "account" ? { username: s.username, password: s.password } : s.key;
}

export function orderKeysEmail(o: {
  orderNumber: string;
  totalCents: number;
  currency: string;
  /** keys are decrypted secrets (keys or encoded accounts). */
  groups: { name: string; keys: string[]; warranty?: string | null; phone?: boolean; steps?: string[] }[];
  /** Free check period, e.g. "24 hours"; null when it's turned off. */
  freeCheck?: string | null;
}): EmailContent {
  const total = formatMoney(o.totalCents, o.currency.toUpperCase());
  const keyCount = o.groups.reduce((n, g) => n + g.keys.length, 0);
  return renderEmail(
    "order-keys",
    {
      orderNumber: o.orderNumber,
      total,
      keyCount,
      groups: o.groups.map((g) => ({ ...g, keys: g.keys.map(emailKey), phone: g.phone ?? false, steps: g.steps ?? [] })),
      anyPhone: o.groups.some((g) => g.phone),
      anyAccount: o.groups.some((g) => g.keys.some((k) => parseSecret(k).kind === "account")),
      replyTime: ACTIVATION_REPLY_TIME,
      detailRows: [
        { label: "Order", value: o.orderNumber },
        { label: "Total paid", value: total },
      ],
      viewUrl: orderViewUrl(o.orderNumber),
      freeCheck: o.freeCheck ?? null,
      invoiceUrl: orderInvoiceUrl(o.orderNumber),
      policyUrl: `${SITE_URL}/legal/refund-policy`,
    },
    {
      subject: `Your ${BRAND.name} keys for order ${o.orderNumber}`,
      preheader: `Your ${keyCount === 1 ? "license key is" : `${keyCount} license keys are`} ready. Order ${o.orderNumber}, ${total}.`,
    },
  );
}

const STATUS_COPY: Record<string, { headline: string; message: string; tone: Tone }> = {
  PENDING: {
    headline: "We're waiting for your payment",
    message: "We haven't received the payment confirmation yet. If you paid, your keys will be emailed as soon as it arrives. If it's been more than an hour, open your order and tell us.",
    tone: "info",
  },
  PAID: {
    headline: "Payment received, keys on the way",
    message: "Your payment went through. We're preparing your keys and will email them shortly.",
    tone: "success",
  },
  EXPIRED: {
    headline: "We didn't receive a payment",
    message: "This order timed out before we got a payment confirmation. If money was taken from your account, open your order and tell us so we can send your keys.",
    tone: "warning",
  },
  FAILED: {
    headline: "The payment didn't go through",
    message: "No payment was taken for this order. If you see a pending charge from your bank, it's a temporary hold that will be released.",
    tone: "warning",
  },
  REFUNDED: {
    headline: "This order was refunded",
    message: "The payment for this order was refunded. Refunds usually reach your account within 5-10 working days.",
    tone: "info",
  },
};

/** Find my order, for an order without keys to send (pending, failed, ...). */
export function orderStatusEmail(o: {
  orderNumber: string;
  status: string;
  totalCents: number;
  currency: string;
}): EmailContent {
  const copy = STATUS_COPY[o.status] ?? STATUS_COPY.PENDING;
  const total = formatMoney(o.totalCents, o.currency.toUpperCase());
  return renderEmail(
    "order-status",
    {
      ...copy,
      orderNumber: o.orderNumber,
      total,
      detailRows: [
        { label: "Order", value: o.orderNumber },
        { label: "Total", value: total },
      ],
      viewUrl: orderViewUrl(o.orderNumber),
    },
    {
      subject: `Your ${BRAND.name} order ${o.orderNumber}`,
      preheader: copy.headline,
    },
  );
}

export function passwordResetEmail(o: { resetUrl: string; ttlMinutes: number }): EmailContent {
  return renderEmail("password-reset", o, {
    subject: `Reset your ${BRAND.name} password`,
    preheader: `Choose a new password. This link works once, for ${o.ttlMinutes} minutes.`,
  });
}

export function signupCodeEmail(o: { code: string; firstName: string; ttlMinutes: number }): EmailContent {
  return renderEmail("signup-code", o, {
    subject: `${o.code} is your ${BRAND.name} sign-up code`,
    preheader: `Enter it to finish creating your account. It expires in ${o.ttlMinutes} minutes.`,
  });
}

export function confirmEmailEmail(o: { confirmUrl: string; orderCount: number; ttlHours: number }): EmailContent {
  return renderEmail(
    "confirm-email",
    { ...o, single: o.orderCount === 1 },
    {
      subject: `Confirm your email to add your ${BRAND.name} orders`,
      preheader: `One click adds ${o.orderCount} past order${o.orderCount === 1 ? "" : "s"} to your account.`,
    },
  );
}

export function passwordChangedEmail(): EmailContent {
  return renderEmail(
    "password-changed",
    { resetUrl: `${SITE_URL}/forgot-password` },
    {
      subject: `Your ${BRAND.name} password was changed`,
      preheader: "If this wasn't you, reset your password right away.",
    },
  );
}

export function paymentReportReceivedEmail(o: { orderNumber: string }): EmailContent {
  return renderEmail("payment-report-received", o, {
    subject: `We're checking your payment for order ${o.orderNumber}`,
    preheader: `We got your message about order ${o.orderNumber} and are checking with our payment provider.`,
  });
}

export function paymentReportClosedEmail(o: { orderNumber: string; message: string }): EmailContent {
  return renderEmail("payment-report-closed", o, {
    subject: `About your payment for order ${o.orderNumber}`,
    preheader: `An update on your payment for order ${o.orderNumber}.`,
  });
}

export function warrantyClaimReceivedEmail(o: {
  orderNumber: string;
  productName: string;
  reasonLabel: string;
}): EmailContent {
  return renderEmail(
    "warranty-claim-received",
    {
      ...o,
      detailRows: [
        { label: "Order", value: o.orderNumber },
        { label: "Product", value: o.productName },
        { label: "Problem", value: o.reasonLabel },
      ],
      viewUrl: orderViewUrl(o.orderNumber),
    },
    {
      subject: `We got your report about order ${o.orderNumber}`,
      preheader: "We'll check your key and send a replacement if it's covered.",
    },
  );
}

const CLAIM_OUTCOME = {
  REPLACED: { headline: "Here's your replacement key", tone: "success" as Tone },
  REFUNDED: { headline: "Your key was refunded", tone: "info" as Tone },
  REJECTED: { headline: "About your key claim", tone: "warning" as Tone },
};

export function warrantyClaimResolvedEmail(o: {
  orderNumber: string;
  productName: string;
  outcome: keyof typeof CLAIM_OUTCOME;
  /** The decrypted replacement secret (key or encoded account). */
  newKey?: string | null;
  /** The replacement is a phone activation key. */
  phone?: boolean;
  warrantyNote?: string | null;
  note?: string | null;
  /** Formatted amount refunded for this key, e.g. "LKR 1,250". */
  refund?: string | null;
}): EmailContent {
  const copy = CLAIM_OUTCOME[o.outcome];
  return renderEmail(
    "warranty-claim-resolved",
    {
      ...o,
      ...copy,
      newKeys: o.newKey ? [emailKey(o.newKey)] : [],
      phone: o.phone ?? false,
      replyTime: ACTIVATION_REPLY_TIME,
      viewUrl: orderViewUrl(o.orderNumber),
    },
    {
      subject: `${copy.headline} (order ${o.orderNumber})`,
      preheader:
        o.outcome === "REPLACED"
          ? `Your new ${o.productName} key is inside.`
          : `An update on your claim for order ${o.orderNumber}.`,
    },
  );
}

export function activationReplyEmail(o: {
  orderNumber: string;
  productName: string;
  /** Digits only. */
  installationId: string;
  /** Digits only; null when we couldn't create one. */
  confirmationId: string | null;
  note?: string | null;
  /** Free check period, e.g. "24 hours" (starts with the first Confirmation ID). */
  freeCheck?: string | null;
}): EmailContent {
  const done = o.confirmationId !== null;
  return renderEmail(
    "activation-reply",
    {
      ...o,
      done,
      confirmationId: o.confirmationId ? formatActivationId(o.confirmationId) : null,
      installationIdFormatted: formatActivationId(o.installationId),
      detailRows: [
        { label: "Order", value: o.orderNumber },
        { label: "Installation ID", value: formatActivationId(o.installationId) },
      ],
      viewUrl: orderViewUrl(o.orderNumber),
    },
    {
      subject: done
        ? `Your confirmation ID for order ${o.orderNumber}`
        : `About your activation request (order ${o.orderNumber})`,
      preheader: done
        ? `Enter it in the ${o.productName} activation window.`
        : `We couldn't create a Confirmation ID for your ${o.productName} key.`,
    },
  );
}

// --- Admin alerts ----------------------------------------------------------------------

const ALERT_STYLE: Record<string, { tone: Tone; label: string }> = {
  FAILED_DELIVERY: { tone: "danger", label: "Action needed" },
  PAYMENT_PROBLEM: { tone: "danger", label: "Payment problem" },
  CUSTOMER_REPORT: { tone: "warning", label: "Customer report" },
  SECURITY: { tone: "warning", label: "Security" },
  WARRANTY_CLAIM: { tone: "warning", label: "Warranty claim" },
  ACTIVATION_REQUEST: { tone: "warning", label: "Activation request" },
  OUT_OF_STOCK: { tone: "danger", label: "Out of stock" },
  LOW_STOCK: { tone: "warning", label: "Low stock" },
  NEW_ORDER: { tone: "success", label: "New order" },
  TEST: { tone: "info", label: "Test" },
};

export function adminAlertEmail(o: { type?: string; subject: string; lines: string[] }): EmailContent {
  const style = ALERT_STYLE[o.type ?? ""] ?? { tone: "info" as Tone, label: "Alert" };
  // Blank lines split paragraphs; the first admin link becomes the button.
  const paragraphs = o.lines
    .join("\n")
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((text) => ({ text }));
  const actionUrl =
    o.lines.join(" ").match(new RegExp(`${SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/admin[^\\s]*`))?.[0] ??
    null;
  return renderEmail(
    "admin-alert",
    { ...style, subject: o.subject, paragraphs, actionUrl },
    {
      subject: `[${BRAND.name}] ${o.subject}`,
      preheader: paragraphs[0]?.text.slice(0, 140) ?? o.subject,
      audience: "admin",
    },
  );
}
