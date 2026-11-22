"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin";
import { categorySchema, slugify } from "@/lib/validation";
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
  const sortRaw = str(formData, "sortOrder");

  const parsed = categorySchema.safeParse({
    name,
    slug: slugify(rawSlug || name),
    description: str(formData, "description"),
    bannerUrl: str(formData, "bannerUrl"),
    bannerMobileUrl: str(formData, "bannerMobileUrl"),
    visible: formData.get("visible") === "on",
    showInHeader: formData.get("showInHeader") === "on",
    sortOrder: sortRaw === "" ? 0 : Number(sortRaw),
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
    sortOrder: data.sortOrder,
  };

  if (id) {
    await prisma.category.update({ where: { id }, data: values });
  } else {
    await prisma.category.create({ data: values });
  }

  revalidateShop();
  redirect("/admin/categories");
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
