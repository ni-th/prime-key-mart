import type { Metadata } from "next";
import Link from "next/link";
import { ImageIcon, Plus } from "lucide-react";
import { getAdminCategories } from "@/lib/admin";
import { optimizedImageUrl } from "@/lib/image-url";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
            Shown in this order in the header, home page and filters.
          </p>
        </div>
        <Link href="/admin/categories/new" className={cn(buttonVariants({ size: "sm" }))}>
          <Plus className="size-4" />
          New category
        </Link>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Order</TableHead>
              <TableHead>Banner</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No categories yet. Create one before adding products.
                </TableCell>
              </TableRow>
            )}
            {categories.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="tabular-nums text-muted-foreground">{c.sortOrder}</TableCell>
                <TableCell>
                  {c.bannerUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of an uploaded URL
                    <img
                      src={optimizedImageUrl(c.bannerUrl, 240)}
                      alt=""
                      className="aspect-4/1 w-28 rounded border object-cover"
                    />
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <ImageIcon className="size-3.5" />
                      None
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Link href={`/admin/categories/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                  <div className="font-mono text-xs text-muted-foreground">{c.slug}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <Link href={`/admin/products?category=${c.slug}`} className="hover:underline">
                    {c._count.products}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {c.visible ? (
                      <Badge variant="secondary">Visible</Badge>
                    ) : (
                      <Badge variant="outline">Hidden</Badge>
                    )}
                    {c.visible && c.showInHeader && <Badge variant="outline">In header</Badge>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
