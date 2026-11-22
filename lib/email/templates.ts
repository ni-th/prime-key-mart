import { BRAND } from "@/lib/brand";
import { formatMoney } from "@/lib/money";
import { SITE_URL, renderEmail, type RenderedEmail, type Tone } from "@/lib/email/render";

/**
 * One function per email. Each prepares the data for its Handlebars template
 * (emails/<name>.hbs + emails/<name>.text.hbs) and the subject line.
 * Preview them all in Admin -> Emails.
 */
export type EmailContent = RenderedEmail;

// --- Customer emails ---------------------------------------------------------------

export function orderKeysEmail(o: {
  orderNumber: string;
  totalCents: number;
  currency: string;
  groups: { name: string; keys: string[] }[];
}): EmailContent {
  const total = formatMoney(o.totalCents, o.currency.toUpperCase());
  const keyCount = o.groups.reduce((n, g) => n + g.keys.length, 0);
  return renderEmail(
    "order-keys",
    {
      orderNumber: o.orderNumber,
      total,
      keyCount,
      groups: o.groups,
      detailRows: [
        { label: "Order", value: o.orderNumber },
        { label: "Total paid", value: total },
      ],
      accountUrl: `${SITE_URL}/account/orders/${encodeURIComponent(o.orderNumber)}`,
    },
    {
      subject: `Your ${BRAND.name} keys for order ${o.orderNumber}`,
      preheader: `Your ${keyCount === 1 ? "license key is" : `${keyCount} license keys are`} ready. Order ${o.orderNumber}, ${total}.`,
    },
  );
}

export function passwordResetEmail(o: { resetUrl: string; ttlMinutes: number }): EmailContent {
  return renderEmail("password-reset", o, {
    subject: `Reset your ${BRAND.name} password`,
    preheader: `Choose a new password. This link works once, for ${o.ttlMinutes} minutes.`,
  });
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

// --- Admin alerts ----------------------------------------------------------------------

const ALERT_STYLE: Record<string, { tone: Tone; label: string }> = {
  FAILED_DELIVERY: { tone: "danger", label: "Action needed" },
  PAYMENT_PROBLEM: { tone: "danger", label: "Payment problem" },
  CUSTOMER_REPORT: { tone: "warning", label: "Customer report" },
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
