"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin";
import { categoryOrderSchema, categorySchema, slugify } from "@/lib/validation";
import type { FormResult } from "@/app/actions/admin";

/** Categories appear in the header, footer and home page: refresh everything. */
function revalidateShop() {
  revalidatePath("/", "layout");
}

function str(formData: FormData, key: string) {
  return ((formData.get(key) as string | null) ?? "").trim();
}

export async function saveCategory(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const id = str(formData, "id") || null;
  const name = str(formData, "name");
  const rawSlug = str(formData, "slug");

  const parsed = categorySchema.safeParse({
    name,
    slug: slugify(rawSlug || name),
    description: str(formData, "description"),
    bannerUrl: str(formData, "bannerUrl"),
    bannerMobileUrl: str(formData, "bannerMobileUrl"),
    visible: formData.get("visible") === "on",
    showInHeader: formData.get("showInHeader") === "on",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const slugOwner = await prisma.category.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });
  if (slugOwner && slugOwner.id !== id) {
    return {
      ok: false,
      error: "That slug is already in use.",
      fieldErrors: { slug: "Already used by another category." },
    };
  }

  const values = {
    name: data.name,
    slug: data.slug,
    description: data.description || null,
    bannerUrl: data.bannerUrl || null,
    bannerMobileUrl: data.bannerMobileUrl || null,
    visible: data.visible,
    showInHeader: data.showInHeader,
  };

  if (id) {
    const existing = await prisma.category.findUnique({ where: { id }, select: { slug: true } });
    if (!existing) return { ok: false, error: "This category no longer exists." };
    await prisma.$transaction([
      // The new slug is live now; it can't also be a redirect.
      prisma.categorySlugRedirect.deleteMany({ where: { slug: data.slug } }),
      prisma.category.update({ where: { id }, data: values }),
      // Keep the old address working: /category/old -> /category/new.
      ...(existing.slug !== data.slug
        ? [
            prisma.categorySlugRedirect.upsert({
              where: { slug: existing.slug },
              create: { slug: existing.slug, categoryId: id },
              update: { categoryId: id },
            }),
          ]
        : []),
    ]);
  } else {
    // New categories go to the end of the list (reorder by dragging).
    const last = await prisma.category.aggregate({ _max: { sortOrder: true } });
    await prisma.$transaction([
      prisma.categorySlugRedirect.deleteMany({ where: { slug: data.slug } }),
      prisma.category.create({
        data: { ...values, sortOrder: (last._max.sortOrder ?? 0) + 1 },
      }),
    ]);
  }

  revalidateShop();
  redirect("/admin/categories");
}

/** Save a new display order (from drag and drop): ids first to last. */
export async function reorderCategories(ids: string[]): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const parsed = categoryOrderSchema.safeParse(ids);
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) {
    return { ok: false, error: "Invalid order." };
  }
  const existing = await prisma.category.findMany({ select: { id: true } });
  const known = new Set(existing.map((c) => c.id));
  if (parsed.data.length !== known.size || parsed.data.some((id) => !known.has(id))) {
    return { ok: false, error: "The category list changed. Reload the page and try again." };
  }

  await prisma.$transaction(
    parsed.data.map((id, index) =>
      prisma.category.update({ where: { id }, data: { sortOrder: index + 1 } }),
    ),
  );
  revalidateShop();
  return { ok: true, message: "Order saved." };
}

export async function deleteCategory(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Missing category id." };

  const productCount = await prisma.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    return {
      ok: false,
      error: `This category still has ${productCount} product${productCount === 1 ? "" : "s"}. Move them to another category first, or hide the category instead.`,
    };
  }

  await prisma.category.delete({ where: { id } });
  revalidateShop();
  redirect("/admin/categories");
}
