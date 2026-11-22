import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { buttonVariants } from "@/components/ui/button";
import { WarrantyPlanList } from "@/components/admin/warranty-plan-list";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Warranty · Admin" };

export default async function AdminWarrantyPage() {
  const [plans, customCount, storeCount, productCount, openClaims] = await Promise.all([
    prisma.warrantyPlan.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { products: true } } },
    }),
    prisma.product.count({ where: { warrantyMode: "CUSTOM" } }),
    prisma.product.count({ where: { warrantyMode: "STORE" } }),
    prisma.product.count(),
    prisma.warrantyClaim.count({ where: { status: "OPEN" } }),
  ]);
  const withWarranty = customCount + storeCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Warranty</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Plans are priced as a percent of the product&apos;s normal price. Warranty is off by
            default: turn it on per product (Warranty section on the product). Products on
            &quot;Store plans&quot; follow the percentages here.
          </p>
          <p className="mt-2 text-sm">
            <Link href="/admin/products?warranty=with" className="font-medium hover:underline">
              {withWarranty} of {productCount} products offer a warranty
            </Link>
            <span className="text-muted-foreground">
              {" "}
              ({storeCount} store plans, {customCount} custom)
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/warranty/claims"
            className={cn(buttonVariants({ variant: openClaims > 0 ? "default" : "outline", size: "sm" }))}
          >
            Claims{openClaims > 0 ? ` (${openClaims} open)` : ""}
          </Link>
          <Link href="/admin/warranty/new" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <Plus className="size-4" />
            New plan
          </Link>
        </div>
      </div>

      <WarrantyPlanList
        key={plans.map((p) => p.id).join(",")}
        plans={plans.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          days: p.days,
          percent: p.percent,
          active: p.active,
          isDefault: p.isDefault,
          recommended: p.recommended,
          customProducts: p._count.products,
        }))}
      />

      <p className="text-xs text-muted-foreground">
        A warranty means a free replacement key (or a refund) if the key stops working during the
        period. Make sure your Terms explain what&apos;s covered.
      </p>
    </div>
  );
}
