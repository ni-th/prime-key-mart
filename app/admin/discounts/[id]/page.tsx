import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDiscountFormProducts } from "@/lib/admin";
import { getAllCategories } from "@/lib/products";
import { getPricingSettings } from "@/lib/pricing";
import { Separator } from "@/components/ui/separator";
import { DiscountForm } from "@/components/admin/discount-form";
import { DeleteDiscountButton } from "@/components/admin/delete-discount-button";
import { DiscountStatusBadge } from "@/components/admin/discount-status-badge";

export const metadata: Metadata = { title: "Edit sale · Admin" };

export default async function EditDiscountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [discount, categories, products, pricing] = await Promise.all([
    prisma.discount.findUnique({
      where: { id },
      include: { categories: { select: { id: true } }, products: { select: { id: true } } },
    }),
    getAllCategories(),
    getDiscountFormProducts(),
    getPricingSettings(),
  ]);
  if (!discount) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{discount.name}</h1>
        <DiscountStatusBadge discount={discount} />
      </div>

      <DiscountForm
        discount={{
          id: discount.id,
          name: discount.name,
          percent: discount.percent,
          scope: discount.scope,
          categoryIds: discount.categories.map((c) => c.id),
          productIds: discount.products.map((p) => p.id),
          active: discount.active,
          startsAt: discount.startsAt?.toISOString() ?? null,
          endsAt: discount.endsAt?.toISOString() ?? null,
        }}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        products={products}
        pricing={{
          rate: pricing.rate,
          marginPercent: pricing.marginPercent,
          gatewayFeePercent: pricing.gatewayFeePercent,
        }}
      />

      <Separator />

      <div>
        <h2 className="text-sm font-medium">Danger zone</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          To stop a sale for now, untick Active instead.
        </p>
        <DeleteDiscountButton id={discount.id} />
      </div>
    </div>
  );
}
