import { PrismaClient } from "@prisma/client";

/**
 * Admin-only money fields (what we pay for keys, gateway fees). Omitted from
 * EVERY query by default so they can never reach a storefront page or the
 * browser by accident (server components pass whole rows to client
 * components). Admin code opts back in with `omit: ADMIN_COST_FIELDS.*`.
 */
const omit = {
  product: { costCents: true, costCurrency: true },
  orderItem: { unitCostCents: true },
  order: { feeCents: true },
  warrantyClaim: { replacementCostCents: true },
} as const;

/** Pass as `omit` in admin queries to include the hidden cost fields. */
export const ADMIN_COST_FIELDS = {
  product: { costCents: false, costCurrency: false },
  orderItem: { unitCostCents: false },
  order: { feeCents: false },
  warrantyClaim: { replacementCostCents: false },
} as const;

function createClient() {
  return new PrismaClient({
    omit,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
