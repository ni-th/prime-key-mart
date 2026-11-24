import { after } from "next/server";
import { prisma } from "@/lib/db";
import { sendAdminAlertEmail } from "@/lib/mailer";
import { notifyBackInStock } from "@/lib/restock";

/**
 * Admin alerts: emails to the store owner when something needs attention.
 *
 * - Each alert type can be switched off in Admin -> Settings.
 * - Recipients come from settings, else ADMIN_EMAIL.
 * - Every attempt is written to AlertLog (shown in admin).
 * - A `dedupeKey` + cool-down stops floods (e.g. stock bouncing around the
 *   threshold as checkouts are abandoned, or a burst of bad webhooks).
 * - Never throws: an alert must never break a checkout or a payment webhook.
 */

export const ALERT_TYPES = {
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
  FAILED_DELIVERY: "Order not delivered",
  PAYMENT_PROBLEM: "Payment problem",
  NEW_ORDER: "New order",
  CUSTOMER_REPORT: "Customer says they paid",
  SECURITY: "Security",
  WARRANTY_CLAIM: "Warranty claim",
  ACTIVATION_REQUEST: "Phone activation request",
  NEW_REVIEW: "New review",
  TEST: "Test",
} as const;
export type AlertType = keyof typeof ALERT_TYPES;

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export type AlertSettings = {
  recipients: string[];
  /** True when recipients come from settings (not the ADMIN_EMAIL fallback). */
  customRecipients: boolean;
  lowStockThreshold: number;
  enabled: Record<
    Exclude<
      AlertType,
      "TEST" | "CUSTOMER_REPORT" | "SECURITY" | "WARRANTY_CLAIM" | "ACTIVATION_REQUEST" | "NEW_REVIEW"
    >,
    boolean
  >;
};

/** Split a comma/space/newline separated list into lower-case emails. */
export function parseEmailList(value: string | null | undefined): string[] {
  return [
    ...new Set(
      (value ?? "")
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function fallbackRecipients(): string[] {
  return parseEmailList(process.env.ADMIN_EMAIL || process.env.SMTP_USER);
}

export async function getAlertSettings(): Promise<AlertSettings> {
  const row = await prisma.storeSettings.findUnique({ where: { id: "default" } });
  const custom = parseEmailList(row?.alertEmails);
  return {
    recipients: custom.length > 0 ? custom : fallbackRecipients(),
    customRecipients: custom.length > 0,
    lowStockThreshold: row?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD,
    enabled: {
      LOW_STOCK: row?.alertLowStock ?? true,
      OUT_OF_STOCK: row?.alertOutOfStock ?? true,
      FAILED_DELIVERY: row?.alertFailedDelivery ?? true,
      PAYMENT_PROBLEM: row?.alertPaymentProblem ?? true,
      NEW_ORDER: row?.alertNewOrder ?? false,
    },
  };
}

export type SendAlertResult = "sent" | "failed" | "disabled" | "suppressed" | "no-recipient";

/**
 * Send one alert (if enabled and not a recent duplicate) and log it.
 * Returns what happened; never throws.
 */
export async function sendAlert(alert: {
  type: AlertType;
  subject: string;
  lines: string[];
  /** Alerts with the same key within `cooldownHours` are logged as SUPPRESSED, not sent. */
  dedupeKey?: string;
  cooldownHours?: number;
}): Promise<SendAlertResult> {
  try {
    const settings = await getAlertSettings();
    // Customer reports follow the "Order not delivered" switch; security
    // notices (e.g. blocked lookups) follow "Payment problems".
    const toggle =
      alert.type === "CUSTOMER_REPORT" || alert.type === "WARRANTY_CLAIM" || alert.type === "ACTIVATION_REQUEST"
        ? "FAILED_DELIVERY"
        : alert.type === "SECURITY"
          ? "PAYMENT_PROBLEM"
          : alert.type === "NEW_REVIEW"
            ? "NEW_ORDER" // store activity notices share the "New order" switch
            : alert.type;
    if (toggle !== "TEST" && !settings.enabled[toggle]) return "disabled";

    const recipients = settings.recipients;
    const body = alert.lines.join("\n");
    const log = (status: string, error?: string) =>
      prisma.alertLog.create({
        data: {
          type: alert.type,
          subject: alert.subject,
          body,
          recipients: recipients.join(", "),
          status,
          error: error?.slice(0, 500),
          dedupeKey: alert.dedupeKey ?? null,
        },
      });

    if (alert.dedupeKey) {
      const since = new Date(Date.now() - (alert.cooldownHours ?? 12) * 3_600_000);
      const recent = await prisma.alertLog.findFirst({
        where: { dedupeKey: alert.dedupeKey, status: "SENT", createdAt: { gte: since } },
        select: { id: true },
      });
      if (recent) {
        await log("SUPPRESSED");
        return "suppressed";
      }
    }

    if (recipients.length === 0) {
      console.warn(`[alerts] no recipient for "${alert.subject}"\n${body}`);
      await log("FAILED", "No recipient: set alert emails in Admin -> Settings or ADMIN_EMAIL.");
      return "no-recipient";
    }

    try {
      await sendAdminAlertEmail({ subject: alert.subject, lines: alert.lines, type: alert.type, to: recipients });
      await log("SENT");
      return "sent";
    } catch (err) {
      console.error(`[alerts] sending "${alert.subject}" failed`, err);
      await log("FAILED", err instanceof Error ? err.message : String(err));
      return "failed";
    }
  } catch (err) {
    console.error("[alerts] alert could not be processed", err);
    return "failed";
  }
}

/**
 * Run alert work after the response is sent (so a slow mail server never
 * delays a customer). Falls back to fire-and-forget outside a request
 * (scripts, tests).
 */
export function runAfterResponse(task: () => Promise<unknown>): void {
  const safe = () => task().catch((err) => console.error("[alerts] background task failed", err));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

// --- Stock alerts ---------------------------------------------------------------

type StockLevel = "LOW" | "OUT" | null;
const severity = (l: StockLevel) => (l === "OUT" ? 2 : l === "LOW" ? 1 : 0);

const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Compare each product's sellable stock with its threshold and alert when it
 * gets worse (fine -> low, low -> out, fine -> out). One email per drop: the
 * level is remembered on the product and only re-armed when stock recovers
 * (keys added, or abandoned checkouts released).
 */
export async function checkStockAlerts(productIds: string[]): Promise<void> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return;

  const [settings, products, counts] = await Promise.all([
    getAlertSettings(),
    prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        published: true,
        lowStockThreshold: true,
        stockAlertState: true,
      },
    }),
    prisma.licenseKey.groupBy({
      by: ["productId"],
      where: { productId: { in: ids }, status: "AVAILABLE" },
      _count: { _all: true },
    }),
  ]);
  const available = new Map(counts.map((c) => [c.productId, c._count._all]));

  // Customers on a waiting list: email them once the product has stock again.
  await notifyBackInStock(
    products.filter((p) => p.published && (available.get(p.id) ?? 0) > 0).map((p) => p.id),
  );

  for (const p of products) {
    const stock = available.get(p.id) ?? 0;
    const threshold = p.lowStockThreshold ?? settings.lowStockThreshold;
    const level: StockLevel = stock === 0 ? "OUT" : stock < threshold ? "LOW" : null;
    const previous = (p.stockAlertState as StockLevel) ?? null;
    if (level === previous) continue;

    // Claim the transition atomically so two concurrent checks can't both send.
    const { count } = await prisma.product.updateMany({
      where: { id: p.id, stockAlertState: previous },
      data: { stockAlertState: level },
    });
    if (count === 0 || severity(level) <= severity(previous)) continue; // recovered: just re-arm
    if (!p.published) continue; // hidden products don't need a restock nudge

    const keysUrl = `${SITE_URL}/admin/products/${p.id}/keys`;
    if (level === "OUT") {
      await sendAlert({
        type: "OUT_OF_STOCK",
        subject: `Out of stock: ${p.name}`,
        lines: [
          `${p.name} has no keys left. Customers can't buy it until you add more.`,
          ``,
          `Add keys: ${keysUrl}`,
        ],
        dedupeKey: `stock:${p.id}:OUT`,
      });
    } else {
      await sendAlert({
        type: "LOW_STOCK",
        subject: `Low stock: ${p.name} (${stock} left)`,
        lines: [
          `${p.name} is running low: ${stock} key${stock === 1 ? "" : "s"} left (alert level: fewer than ${threshold}).`,
          ``,
          `Add keys: ${keysUrl}`,
        ],
        dedupeKey: `stock:${p.id}:LOW`,
      });
    }
  }
}

/** checkStockAlerts after the response (see runAfterResponse). */
export function queueStockCheck(productIds: string[]): void {
  if (productIds.length === 0) return;
  runAfterResponse(() => checkStockAlerts(productIds));
}

/** Products in an order, for stock checks after reserving/selling/releasing. */
export async function productIdsOfOrder(orderId: string): Promise<string[]> {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    select: { productId: true },
  });
  return items.map((i) => i.productId);
}
