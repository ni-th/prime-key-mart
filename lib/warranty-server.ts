import { cache } from "react";
import { prisma } from "@/lib/db";
import type { WarrantyOption } from "@/lib/warranty";

/** Active plans in display order. Cached per request. */
export const getActiveWarrantyPlans = cache(async () =>
  prisma.warrantyPlan.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  }),
);

/**
 * Warranty options each product offers: none ("NONE", the default), every
 * active plan at its store percentage ("STORE"), or the product's own
 * selection and percentages ("CUSTOM"). Returns productId -> options in
 * display order (empty = no warranty).
 */
export async function getWarrantyOptions(productIds: string[]): Promise<Map<string, WarrantyOption[]>> {
  const ids = [...new Set(productIds)];
  const result = new Map<string, WarrantyOption[]>();
  if (ids.length === 0) return result;

  const [plans, products] = await Promise.all([
    getActiveWarrantyPlans(),
    prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, warrantyMode: true, warrantyOverrides: { select: { planId: true, percent: true } } },
    }),
  ]);

  const toOption = (p: (typeof plans)[number], percent: number): WarrantyOption => ({
    planId: p.id,
    name: p.name,
    description: p.description,
    days: p.days,
    // The included plan is always free.
    percent: p.isDefault ? 0 : percent,
    isDefault: p.isDefault,
    recommended: p.recommended,
  });

  for (const product of products) {
    if (product.warrantyMode === "STORE") {
      result.set(product.id, plans.map((p) => toOption(p, p.percent)));
    } else if (product.warrantyMode === "CUSTOM") {
      const chosen = new Map(product.warrantyOverrides.map((o) => [o.planId, o.percent]));
      result.set(
        product.id,
        plans.filter((p) => chosen.has(p.id)).map((p) => toOption(p, chosen.get(p.id) ?? p.percent)),
      );
    } else {
      result.set(product.id, []); // NONE: this product has no warranty
    }
  }
  return result;
}
