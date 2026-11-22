import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { CategoryForm } from "@/components/admin/category-form";

export const metadata: Metadata = { title: "New category · Admin" };

export default async function NewCategoryPage() {
  const last = await prisma.category.aggregate({ _max: { sortOrder: true } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New category</h1>
      <CategoryForm
        uploadsEnabled={isCloudinaryConfigured}
        nextSortOrder={(last._max.sortOrder ?? 0) + 1}
      />
    </div>
  );
}
