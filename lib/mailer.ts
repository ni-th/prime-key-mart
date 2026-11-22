import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import {
  adminAlertEmail,
  orderKeysEmail,
  passwordChangedEmail,
  passwordResetEmail,
  paymentReportClosedEmail,
  paymentReportReceivedEmail,
  type EmailContent,
} from "@/lib/email/templates";

let cached: Transporter | null = null;
let cachedIsEthereal = false;

/** Sender for all mail: SMTP_FROM, else the SMTP account itself. */
function mailFrom(): string {
  if (process.env.SMTP_FROM) return process.env.SMTP_FROM;
  return process.env.SMTP_USER ? `Keysby <${process.env.SMTP_USER}>` : "Keysby";
}

async function getTransport(): Promise<Transporter | null> {
  if (cached) return cached;

  const host = process.env.SMTP_HOST;
  if (host) {
    cached = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    return cached;
  }

  // No SMTP configured - spin up a disposable Ethereal inbox so keys are still
  // "sent" somewhere you can look at (preview URL is logged).
  try {
    const test = await nodemailer.createTestAccount();
    cached = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: test.user, pass: test.pass },
    });
    cachedIsEthereal = true;
    console.log(`[mailer] SMTP not configured - using Ethereal test inbox (${test.user})`);
    return cached;
  } catch (err) {
    console.warn("[mailer] Could not create an Ethereal test account:", err);
    return null;
  }
}

/** Send one rendered email (templates live in emails/*.hbs). */
export async function sendRenderedEmail(to: string, email: EmailContent): Promise<void> {
  return send(to, email);
}

async function send(to: string, email: EmailContent): Promise<void> {
  const transport = await getTransport();
  if (!transport) {
    console.log(`[mailer] (no transport) ${email.subject} -> ${to}\n${email.text}`);
    return;
  }
  const info = await transport.sendMail({
    from: mailFrom(),
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
  if (cachedIsEthereal) {
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log(`[mailer] Preview "${email.subject}": ${preview}`);
  }
}

/**
 * Alert to the store owner. Use sendAlert() in lib/alerts.ts rather than
 * calling this directly: it adds the on/off settings, de-duplication and the
 * alert log.
 */
export async function sendAdminAlertEmail(alert: {
  subject: string;
  lines: string[];
  /** Alert type (colours the badge), e.g. "LOW_STOCK". */
  type?: string;
  /** Recipients; defaults to ADMIN_EMAIL, then SMTP_USER. */
  to?: string[];
}): Promise<void> {
  const to =
    alert.to && alert.to.length > 0
      ? alert.to.join(", ")
      : process.env.ADMIN_EMAIL || process.env.SMTP_USER;
  if (!to) {
    console.warn(`[mailer] (no admin recipient) ${alert.subject}\n${alert.lines.join("\n")}`);
    return;
  }
  await send(to, adminAlertEmail(alert));
}

/** Confirmation to a customer who reported "I paid but got no keys". */
export async function sendPaymentReportReceivedEmail(to: string, orderNumber: string): Promise<void> {
  await send(to, paymentReportReceivedEmail({ orderNumber }));
}

/** Admin closed a "paid but no keys" report: their message to the customer. */
export async function sendPaymentReportClosedEmail(
  to: string,
  orderNumber: string,
  message: string,
): Promise<void> {
  await send(to, paymentReportClosedEmail({ orderNumber, message }));
}

/** "Forgot password" email with a one-time reset link. */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  ttlMinutes: number,
): Promise<void> {
  await send(to, passwordResetEmail({ resetUrl, ttlMinutes }));
}

/** Heads-up after a password change, so an owner notices an unexpected reset. */
export async function sendPasswordChangedEmail(to: string): Promise<void> {
  await send(to, passwordChangedEmail());
}

/** Sends the license keys for a fulfilled order. Safe to call more than once. */
export async function sendOrderKeysEmail(orderNumber: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: { include: { licenseKeys: true } } },
  });
  if (!order) return;

  const groups = order.items.map((item) => ({
    name: item.productName,
    keys: item.licenseKeys
      .filter((k) => k.status === "SOLD")
      .map((k) =>
        decryptSecret({ ciphertext: k.secretCiphertext, iv: k.secretIv, authTag: k.secretAuthTag }),
      ),
  }));

  await send(
    order.email,
    orderKeysEmail({
      orderNumber: order.orderNumber,
      totalCents: order.totalCents,
      currency: order.currency,
      groups,
    }),
  );
}
