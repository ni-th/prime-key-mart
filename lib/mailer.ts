import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { formatMoney } from "@/lib/money";

let cached: Transporter | null = null;
let cachedIsEthereal = false;

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

  // No SMTP configured — spin up a disposable Ethereal inbox so keys are still
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
    console.log(`[mailer] SMTP not configured — using Ethereal test inbox (${test.user})`);
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
      <p style="color:#666;font-size:13px">Keep this email safe. You can also view these keys any time from your KeyMart account.</p>
    </div>`;

  return { text, html };
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
    from: process.env.SMTP_FROM || "KeyMart <no-reply@keymart.test>",
    to: order.email,
    subject: `Your KeyMart order ${order.orderNumber}`,
    text,
    html,
  });

  if (cachedIsEthereal) {
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log(`[mailer] Preview ${order.orderNumber}: ${preview}`);
  }
}
