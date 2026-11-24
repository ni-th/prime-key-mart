import { prisma } from "@/lib/db";

export type Maintenance = { on: boolean; message: string | null };

/**
 * How long the proxy trusts its copy of the setting. Toggling takes effect
 * within this time on every server instance (immediately on the one that
 * saved it). The checkout API re-reads the database, so no order slips in.
 */
const CACHE_MS = 10_000;
let cached: { value: Maintenance; at: number } | null = null;

/** Read straight from the database (checkout, admin pages). */
export async function readMaintenance(): Promise<Maintenance> {
  const row = await prisma.storeSettings.findUnique({
    where: { id: "default" },
    select: { maintenanceMode: true, maintenanceMessage: true },
  });
  return { on: row?.maintenanceMode ?? false, message: row?.maintenanceMessage ?? null };
}

/**
 * Cached read for the proxy (runs on every request). If the database can't
 * be reached, the store stays open rather than locking everyone out.
 */
export async function getMaintenance(): Promise<Maintenance> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  try {
    const value = await readMaintenance();
    cached = { value, at: Date.now() };
    return value;
  } catch (err) {
    console.error("[maintenance] could not read the setting", err);
    return cached?.value ?? { on: false, message: null };
  }
}

/** After saving the setting, so this instance applies it straight away. */
export function clearMaintenanceCache(): void {
  cached = null;
}

/**
 * Paths that keep working for everyone during maintenance: admin and sign-in
 * (to turn it off again), payment notifications and order pages (payments in
 * flight must complete and customers must still reach their keys), and the
 * maintenance page itself.
 */
const OPEN_PREFIXES = [
  "/admin",
  "/login",
  "/two-factor",
  "/forgot-password",
  "/reset-password",
  "/account",
  "/order", // private order link from emails
  "/order-lookup", // "Find my order"
  "/checkout/success",
  "/checkout/cancel",
  "/maintenance",
  "/api/auth",
  "/api/webhooks",
  "/api/orders", // order status polling and invoice PDFs
  "/api/checkout/release",
];

export function isOpenDuringMaintenance(pathname: string): boolean {
  return OPEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
