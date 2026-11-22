import type { Metadata } from "next";
import { categoryPath } from "@/lib/category-url";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CategoryForm } from "@/components/admin/category-form";
import { DeleteCategoryButton } from "@/components/admin/delete-category-button";

export const metadata: Metadata = { title: "Edit category · Admin" };

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: { select: { products: true } },
      slugRedirects: { orderBy: { createdAt: "desc" }, select: { slug: true } },
    },
  });
  if (!category) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{category.name}</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/products?category=${category.slug}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Products ({category._count.products})
          </Link>
          {category.visible && (
            <Link
              href={categoryPath(category.slug)}
              target="_blank"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <ExternalLink className="size-4" />
              View in shop
            </Link>
          )}
        </div>
      </div>

      <CategoryForm
        uploadsEnabled={isCloudinaryConfigured}
        category={{
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          bannerUrl: category.bannerUrl,
          bannerMobileUrl: category.bannerMobileUrl,
          visible: category.visible,
          showInHeader: category.showInHeader,
        }}
      />

      {category.slugRedirects.length > 0 && (
        <div className="text-sm">
          <h2 className="font-medium">Old addresses</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            These used to be this category&apos;s address and now redirect here.
          </p>
          <ul className="space-y-1 font-mono text-xs text-muted-foreground">
            {category.slugRedirects.map((r) => (
              <li key={r.slug}>
                {categoryPath(r.slug)} &rarr; {categoryPath(category.slug)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Separator />

      <div>
        <h2 className="text-sm font-medium">Danger zone</h2>
        <p className="mb-3 text-xs text-muted-foreground">Only empty categories can be deleted.</p>
        <DeleteCategoryButton id={category.id} />
      </div>
    </div>
  );
}
