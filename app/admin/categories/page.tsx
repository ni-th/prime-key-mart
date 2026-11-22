import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getAdminCategories } from "@/lib/admin";
import { buttonVariants } from "@/components/ui/button";
import { CategorySortList } from "@/components/admin/category-sort-list";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Categories · Admin" };

export default async function AdminCategoriesPage() {
  const categories = await getAdminCategories();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Shown in this order in the header, footer, home page and filters.
          </p>
        </div>
        <Link href="/admin/categories/new" className={cn(buttonVariants({ size: "sm" }))}>
          <Plus className="size-4" />
          New category
        </Link>
      </div>

      <CategorySortList
        // Remount with fresh data after a save elsewhere (e.g. a new category).
        key={categories.map((c) => c.id).join(",")}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          bannerUrl: c.bannerUrl,
          productCount: c._count.products,
          visible: c.visible,
          showInHeader: c.showInHeader,
        }))}
      />
    </div>
  );
}
