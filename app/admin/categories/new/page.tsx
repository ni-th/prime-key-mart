import type { Metadata } from "next";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { CategoryForm } from "@/components/admin/category-form";

export const metadata: Metadata = { title: "New category · Admin" };

export default async function NewCategoryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New category</h1>
      <CategoryForm uploadsEnabled={isCloudinaryConfigured} />
      <p className="text-xs text-muted-foreground">
        New categories are added at the end. Drag them into place on the Categories page.
      </p>
    </div>
  );
}
