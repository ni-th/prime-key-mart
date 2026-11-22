import type { Metadata } from "next";
import { getCategories } from "@/lib/products";
import { ProductForm } from "@/components/admin/product-form";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { getPricingSettings } from "@/lib/pricing";

export const metadata: Metadata = { title: "New product · Admin" };

export default async function NewProductPage() {
  const [categories, pricing] = await Promise.all([getCategories(), getPricingSettings()]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New product</h1>
      <ProductForm
        categories={categories}
        uploadsEnabled={isCloudinaryConfigured}
        pricing={{
          rate: pricing.rate,
          marginPercent: pricing.marginPercent,
          gatewayFeePercent: pricing.gatewayFeePercent,
        }}
      />
    </div>
  );
}
