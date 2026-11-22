"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { MARGIN_MAX, RATE_MAX, RATE_MIN } from "@/lib/pricing";
import { FEE_MAX_PERCENT } from "@/lib/profit";

export type SettingsResult =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const schema = z.object({
  rate: z
    .number({ error: "Enter the exchange rate" })
    .min(RATE_MIN, `That looks wrong: rates below ${RATE_MIN} are rejected`)
    .max(RATE_MAX, `That looks wrong: rates above ${RATE_MAX} are rejected`),
  margin: z
    .number({ error: "Enter a margin (0 for none)" })
    .min(0, "Margin can't be negative")
    .max(MARGIN_MAX, `Keep the margin at ${MARGIN_MAX}% or less`),
  fee: z
    .number({ error: "Enter the gateway fee (0 for none)" })
    .min(0, "The fee can't be negative")
    .max(FEE_MAX_PERCENT, `That looks wrong: fees above ${FEE_MAX_PERCENT}% are rejected`),
});

/** Save the USD -> LKR exchange rate and margin used for calculated LKR prices. */
export async function savePricingSettings(
  _prev: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const parsed = schema.safeParse({
    rate: Number.parseFloat(String(formData.get("rate") ?? "")),
    margin: Number.parseFloat(String(formData.get("margin") ?? "0") || "0"),
    fee: Number.parseFloat(String(formData.get("fee") ?? "0") || "0"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const rate = Math.round(parsed.data.rate * 100) / 100;
  const margin = Math.round(parsed.data.margin * 100) / 100;
  const fee = Math.round(parsed.data.fee * 100) / 100;
  const values = {
    usdToLkrRate: rate,
    lkrMarginPercent: margin,
    gatewayFeePercent: fee,
    updatedBy: admin.user.email,
  };
  await prisma.storeSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...values },
    update: values,
  });

  // Prices are shown across the store; refresh every cached page.
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved. New LKR prices apply immediately." };
}
