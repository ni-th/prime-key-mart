import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KeyRound } from "lucide-react";
import { ADMIN_COST_FIELDS, prisma } from "@/lib/db";
import { getAllCategories, availableStockByProduct } from "@/lib/products";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ProductForm } from "@/components/admin/product-form";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { getPricingSettings } from "@/lib/pricing";
import { getAlertSettings } from "@/lib/alerts";
import { getActiveWarrantyPlans } from "@/lib/warranty-server";
import { DeleteProductButton } from "@/components/admin/delete-product-button";

export const metadata: Metadata = { title: "Edit product · Admin" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, categories, pricing, alerts, plans] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      omit: ADMIN_COST_FIELDS.product,
      include: { warrantyOverrides: { select: { planId: true, percent: true } } },
    }),
    getAllCategories(),
    getPricingSettings(),
    getAlertSettings(),
    getActiveWarrantyPlans(),
  ]);
  if (!product) notFound();

  const stock = (await availableStockByProduct([product.id])).get(product.id) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
        <Link
          href={`/admin/products/${product.id}/keys`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <KeyRound className="size-4" />
          Manage keys ({stock} in stock)
        </Link>
      </div>

      <ProductForm
        uploadsEnabled={isCloudinaryConfigured}
        defaultLowStock={alerts.lowStockThreshold}
        warrantyPlans={plans.map((p) => ({ id: p.id, name: p.name, days: p.days, percent: p.percent, isDefault: p.isDefault }))}
        pricing={{
          rate: pricing.rate,
          marginPercent: pricing.marginPercent,
          gatewayFeePercent: pricing.gatewayFeePercent,
        }}
        categories={categories}
        product={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          shortDescription: product.shortDescription,
          description: product.description,
          brand: product.brand,
          platform: product.platform,
          region: product.region,
          priceCents: product.priceCents,
          priceLkrCents: product.priceLkrCents,
          costCents: product.costCents,
          costCurrency: product.costCurrency === "LKR" ? "LKR" : "USD",
          lowStockThreshold: product.lowStockThreshold,
          warrantyMode:
            product.warrantyMode === "CUSTOM" || product.warrantyMode === "STORE"
              ? product.warrantyMode
              : "NONE",
          warrantyOverrides: Object.fromEntries(product.warrantyOverrides.map((o) => [o.planId, o.percent])),
          categoryId: product.categoryId,
          imageUrl: product.imageUrl,
          published: product.published,
          featured: product.featured,
        }}
      />

      <Separator />

      <div>
        <h2 className="text-sm font-medium">Danger zone</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Deleting is only possible while the product has never been ordered.
        </p>
        <DeleteProductButton id={product.id} />
      </div>
    </div>
  );
}
