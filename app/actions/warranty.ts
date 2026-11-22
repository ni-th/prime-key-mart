"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin";
import type { FormResult } from "@/app/actions/admin";
import { WARRANTY_MAX_PERCENT } from "@/lib/warranty";

const planSchema = z
  .object({
    name: z.string().trim().min(2, "Give the plan a name").max(40),
    description: z.string().trim().max(120, "Keep it under 120 characters"),
    lifetime: z.boolean(),
    days: z
      .number({ error: "Enter the number of days" })
      .int("Use whole days")
      .min(1, "At least 1 day")
      .max(3650, "At most 10 years (3650 days)")
      .nullable(),
    percent: z
      .number({ error: "Enter a percentage (0 for free)" })
      .min(0, "Can't be negative")
      .max(WARRANTY_MAX_PERCENT, `At most ${WARRANTY_MAX_PERCENT}%`),
    active: z.boolean(),
    isDefault: z.boolean(),
    recommended: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (!d.lifetime && d.days === null) {
      ctx.addIssue({ code: "custom", path: ["days"], message: "Enter the number of days, or tick Lifetime" });
    }
  });

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function saveWarrantyPlan(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const id = String(formData.get("id") ?? "").trim() || null;
  const daysRaw = String(formData.get("days") ?? "").trim();
  const parsed = planSchema.safeParse({
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    lifetime: formData.get("lifetime") === "on",
    days: formData.get("lifetime") === "on" || daysRaw === "" ? null : Number(daysRaw),
    percent: Number.parseFloat(String(formData.get("percent") ?? "0") || "0"),
    active: formData.get("active") === "on",
    isDefault: formData.get("isDefault") === "on",
    recommended: formData.get("recommended") === "on",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const d = parsed.data;

  // Plan names must be unique (ignoring case and extra spaces), otherwise
  // customers would see two identical options.
  const name = d.name.replace(/\s+/g, " ");
  const clash = await prisma.warrantyPlan.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(id && { id: { not: id } }) },
    select: { name: true },
  });
  if (clash) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { name: `There's already a plan called "${clash.name}". Use a different name.` },
    };
  }

  const values = {
    name,
    description: d.description || null,
    days: d.lifetime ? null : d.days,
    // The included plan is free by definition.
    percent: d.isDefault ? 0 : Math.round(d.percent * 10) / 10,
    active: d.active || d.isDefault,
    isDefault: d.isDefault,
    recommended: d.recommended,
  };

  await prisma.$transaction(async (tx) => {
    // Only one included plan and one "most popular" plan.
    if (d.isDefault) await tx.warrantyPlan.updateMany({ where: { id: { not: id ?? "" } }, data: { isDefault: false } });
    if (d.recommended) await tx.warrantyPlan.updateMany({ where: { id: { not: id ?? "" } }, data: { recommended: false } });
    if (id) {
      await tx.warrantyPlan.update({ where: { id }, data: values });
    } else {
      const last = await tx.warrantyPlan.aggregate({ _max: { sortOrder: true } });
      await tx.warrantyPlan.create({ data: { ...values, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    }
  });

  revalidateAll();
  redirect("/admin/warranty");
}

export async function deleteWarrantyPlan(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Missing plan." };

  // Orders keep their own copy of the plan (name, length, price, expiry).
  await prisma.warrantyPlan.delete({ where: { id } });
  revalidateAll();
  redirect("/admin/warranty");
}

/** New display order (ids first to last), from drag and drop / arrows. */
export async function reorderWarrantyPlans(ids: string[]): Promise<FormResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };
  const parsed = z.array(z.string().min(1)).max(50).safeParse(ids);
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) {
    return { ok: false, error: "Invalid order." };
  }
  const existing = await prisma.warrantyPlan.findMany({ select: { id: true } });
  const known = new Set(existing.map((p) => p.id));
  if (parsed.data.length !== known.size || parsed.data.some((x) => !known.has(x))) {
    return { ok: false, error: "The plan list changed. Reload the page and try again." };
  }
  await prisma.$transaction(
    parsed.data.map((planId, i) => prisma.warrantyPlan.update({ where: { id: planId }, data: { sortOrder: i + 1 } })),
  );
  revalidateAll();
  return { ok: true, message: "Order saved." };
}

export type FreeCheckState = { status: "idle" } | { status: "done"; message: string } | { status: "error"; error: string };

/**
 * How long after delivery every key (warranty or not) can be reported as not
 * working. 0 turns it off. Capped at a week: longer cover is what warranty
 * plans are for.
 */
export async function saveFreeCheckHours(_prev: FreeCheckState, formData: FormData): Promise<FreeCheckState> {
  const admin = await getAdminSession();
  if (!admin) return { status: "error", error: "Not authorized." };

  const hours = Number(formData.get("hours"));
  if (!Number.isInteger(hours) || hours < 0 || hours > 168) {
    return { status: "error", error: "Enter whole hours from 0 (off) to 168 (7 days)." };
  }
  await prisma.storeSettings.upsert({
    where: { id: "default" },
    create: { id: "default", freeCheckHours: hours, updatedBy: admin.user.email },
    update: { freeCheckHours: hours, updatedBy: admin.user.email },
  });
  revalidatePath("/admin/warranty");
  revalidatePath("/", "layout");
  return {
    status: "done",
    message: hours === 0 ? "Free check period turned off." : `Every key can now be reported within ${hours} hours of delivery.`,
  };
}
