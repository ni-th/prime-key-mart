import type { Metadata } from "next";
import { getAllCategories } from "@/lib/products";
import { ProductForm } from "@/components/admin/product-form";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { getPricingSettings } from "@/lib/pricing";
import { getAlertSettings } from "@/lib/alerts";
import { getActiveWarrantyPlans } from "@/lib/warranty-server";

export const metadata: Metadata = { title: "New product · Admin" };

export default async function NewProductPage() {
  const [categories, pricing, alerts, plans] = await Promise.all([
    getAllCategories(),
    getPricingSettings(),
    getAlertSettings(),
    getActiveWarrantyPlans(),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New product</h1>
      <ProductForm
        categories={categories}
        uploadsEnabled={isCloudinaryConfigured}
        defaultLowStock={alerts.lowStockThreshold}
        warrantyPlans={plans.map((p) => ({ id: p.id, name: p.name, days: p.days, percent: p.percent, isDefault: p.isDefault }))}
        pricing={{
          rate: pricing.rate,
          marginPercent: pricing.marginPercent,
          gatewayFeePercent: pricing.gatewayFeePercent,
        }}
      />
    </div>
  );
}
