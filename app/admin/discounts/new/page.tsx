import type { Metadata } from "next";
import { getDiscountFormProducts } from "@/lib/admin";
import { getAllCategories } from "@/lib/products";
import { getPricingSettings } from "@/lib/pricing";
import { DiscountForm } from "@/components/admin/discount-form";

export const metadata: Metadata = { title: "New sale · Admin" };

export default async function NewDiscountPage() {
  const [categories, products, pricing] = await Promise.all([
    getAllCategories(),
    getDiscountFormProducts(),
    getPricingSettings(),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New sale</h1>
      <DiscountForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        products={products}
        pricing={{
          rate: pricing.rate,
          marginPercent: pricing.marginPercent,
          gatewayFeePercent: pricing.gatewayFeePercent,
        }}
      />
    </div>
  );
}
