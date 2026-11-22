import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { formatMoney } from "@/lib/money";

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

type OrderForEmail = {
  orderNumber: string;
  email: string;
  totalCents: number;
  currency: string;
  items: {
    productName: string;
    licenseKeys: {
      status: string;
      secretCiphertext: string;
      secretIv: string;
      secretAuthTag: string;
    }[];
  }[];
};

function renderEmail(order: OrderForEmail) {
  const groups = order.items.map((item) => ({
    name: item.productName,
    keys: item.licenseKeys
      .filter((k) => k.status === "SOLD")
      .map((k) =>
        decryptSecret({
          ciphertext: k.secretCiphertext,
          iv: k.secretIv,
          authTag: k.secretAuthTag,
        }),
      ),
  }));

  const text = [
    `Thanks for your order ${order.orderNumber}.`,
    ``,
    `Total: ${formatMoney(order.totalCents, order.currency.toUpperCase())}`,
    ``,
    ...groups.flatMap((g) => [
      `${g.name}`,
      ...g.keys.map((k) => `  ${k}`),
      ``,
    ]),
    `Keep this email safe. You can also view these keys any time from your account.`,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
      <h2>Thanks for your order</h2>
      <p>Order <strong>${order.orderNumber}</strong> · ${formatMoney(order.totalCents, order.currency.toUpperCase())}</p>
      ${groups
        .map(
          (g) => `
        <div style="margin:16px 0;padding:16px;border:1px solid #e5e5e5;border-radius:12px">
          <div style="font-weight:600;margin-bottom:8px">${g.name}</div>
          ${g.keys
            .map(
              (k) =>
                `<code style="display:block;padding:8px 10px;background:#f5f5f5;border-radius:8px;font-size:14px;margin:4px 0">${k}</code>`,
            )
            .join("")}
        </div>`,
        )
        .join("")}
      <p style="color:#666;font-size:13px">Keep this email safe. You can also view these keys any time from your Keysby account.</p>
    </div>`;

  return { text, html };
}

/**
 * Plain-text alert to the store owner. Use sendAlert() in lib/alerts.ts rather
 * than calling this directly: it adds the on/off settings, de-duplication and
 * the alert log.
 */
export async function sendAdminAlertEmail(alert: {
  subject: string;
  lines: string[];
  /** Recipients; defaults to ADMIN_EMAIL, then SMTP_USER. */
  to?: string[];
}): Promise<void> {
  const to =
    alert.to && alert.to.length > 0
      ? alert.to.join(", ")
      : process.env.ADMIN_EMAIL || process.env.SMTP_USER;
  const text = alert.lines.join("\n");
  const transport = to ? await getTransport() : null;

  if (!to || !transport) {
    console.warn(`[mailer] (no admin recipient) ${alert.subject}\n${text}`);
    return;
  }

  const info = await transport.sendMail({
    from: mailFrom(),
    to,
    subject: `[Keysby] ${alert.subject}`,
    text,
  });

  if (cachedIsEthereal) {
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log(`[mailer] Preview admin alert: ${preview}`);
  }
}

async function sendSimpleEmail(to: string, subject: string, text: string, html: string) {
  const transport = await getTransport();
  if (!transport) {
    console.log(`[mailer] (no transport) ${subject} -> ${to}\n${text}`);
    return;
  }
  const info = await transport.sendMail({
    from: mailFrom(),
    to,
    subject,
    text,
    html,
  });
  if (cachedIsEthereal) {
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log(`[mailer] Preview "${subject}": ${preview}`);
  }
}

const emailShell = (body: string) =>
  `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">${body}</div>`;

/** "Forgot password" email with a one-time reset link. */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  ttlMinutes: number,
): Promise<void> {
  const text = [
    `Someone (hopefully you) asked to reset the password for your Keysby account.`,
    ``,
    `Reset it here (link works once, for ${ttlMinutes} minutes):`,
    resetUrl,
    ``,
    `If you didn't ask for this, ignore this email - your password won't change.`,
  ].join("\n");
  const html = emailShell(`
    <h2>Reset your password</h2>
    <p>Someone (hopefully you) asked to reset the password for your Keysby account.</p>
    <p style="margin:24px 0">
      <a href="${resetUrl}" style="background:#594cf4;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Choose a new password</a>
    </p>
    <p style="color:#666;font-size:13px">This link works once and expires in ${ttlMinutes} minutes.
    If you didn't ask for this, ignore this email - your password won't change.</p>
    <p style="color:#999;font-size:12px;word-break:break-all">${resetUrl}</p>`);
  await sendSimpleEmail(to, "Reset your Keysby password", text, html);
}

/** Heads-up after a password change, so an owner notices an unexpected reset. */
export async function sendPasswordChangedEmail(to: string): Promise<void> {
  const text = [
    `The password for your Keysby account was just changed.`,
    ``,
    `If this was you, no action is needed.`,
    `If it wasn't, reset your password right away from the sign-in page and contact support.`,
  ].join("\n");
  const html = emailShell(`
    <h2>Your password was changed</h2>
    <p>The password for your Keysby account was just changed.</p>
    <p style="color:#666;font-size:13px">If this was you, no action is needed. If it wasn't,
    reset your password right away from the sign-in page and contact support.</p>`);
  await sendSimpleEmail(to, "Your Keysby password was changed", text, html);
}

/** Sends the license keys for a fulfilled order. Safe to call more than once. */
export async function sendOrderKeysEmail(orderNumber: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: { include: { licenseKeys: true } } },
  });
  if (!order) return;

  const { text, html } = renderEmail(order);
  const transport = await getTransport();

  if (!transport) {
    console.log(
      `[mailer] (no transport) keys for ${order.orderNumber} -> ${order.email}\n${text}`,
    );
    return;
  }

  const info = await transport.sendMail({
    from: mailFrom(),
    to: order.email,
    subject: `Your Keysby order ${order.orderNumber}`,
    text,
    html,
  });

  if (cachedIsEthereal) {
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log(`[mailer] Preview ${order.orderNumber}: ${preview}`);
  }
}
