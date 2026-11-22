"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin";
import { discountSchema } from "@/lib/validation";
import type { FormResult } from "@/app/actions/admin";

/** Sale prices show across the whole shop. */
function revalidateShop() {
  revalidatePath("/", "layout");
}

export async function saveDiscount(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const id = ((formData.get("id") as string | null) ?? "").trim() || null;
  const parsed = discountSchema.safeParse({
    name: formData.get("name") ?? "",
    percent: Number.parseFloat(String(formData.get("percent") ?? "")),
    scope: formData.get("scope"),
    categoryIds: formData.getAll("categoryIds").map(String),
    productIds: formData.getAll("productIds").map(String),
    active: formData.get("active") === "on",
    // ISO strings, converted from the admin's local time in the browser.
    startsAt: formData.get("startsAt") ?? "",
    endsAt: formData.get("endsAt") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const d = parsed.data;

  // Only keep the targets that match the scope, and only ones that exist.
  const [categories, products] = await Promise.all([
    d.scope === "CATEGORIES"
      ? prisma.category.findMany({ where: { id: { in: d.categoryIds } }, select: { id: true } })
      : [],
    d.scope === "PRODUCTS"
      ? prisma.product.findMany({ where: { id: { in: d.productIds } }, select: { id: true } })
      : [],
  ]);

  const data = {
    name: d.name,
    percent: d.percent,
    scope: d.scope,
    active: d.active,
    startsAt: d.startsAt,
    endsAt: d.endsAt,
  };

  if (id) {
    await prisma.discount.update({
      where: { id },
      data: {
        ...data,
        categories: { set: categories.map((c) => ({ id: c.id })) },
        products: { set: products.map((p) => ({ id: p.id })) },
      },
    });
  } else {
    await prisma.discount.create({
      data: {
        ...data,
        categories: { connect: categories.map((c) => ({ id: c.id })) },
        products: { connect: products.map((p) => ({ id: p.id })) },
      },
    });
  }

  revalidateShop();
  redirect("/admin/discounts");
}

export async function deleteDiscount(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const id = ((formData.get("id") as string | null) ?? "").trim();
  if (!id) return { ok: false, error: "Missing sale id." };

  // Past orders keep their own copy of the sale name and percent.
  await prisma.discount.delete({ where: { id } });
  revalidateShop();
  redirect("/admin/discounts");
}
