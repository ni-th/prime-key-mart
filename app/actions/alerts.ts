"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { checkStockAlerts, getAlertSettings, parseEmailList, sendAlert } from "@/lib/alerts";

export type AlertSettingsResult =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const schema = z.object({
  emails: z.array(z.email()).max(10, "Use at most 10 addresses"),
  lowStockThreshold: z
    .number({ error: "Enter a number" })
    .int("Use a whole number")
    .min(1, "Use 1 or more")
    .max(1000),
});

export async function saveAlertSettings(
  _prev: AlertSettingsResult | null,
  formData: FormData,
): Promise<AlertSettingsResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const emails = parseEmailList(String(formData.get("alertEmails") ?? ""));
  const invalid = emails.filter((e) => !z.email().safeParse(e).success);
  if (invalid.length > 0) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { alertEmails: `Not a valid email: ${invalid.join(", ")}` },
    };
  }
  const parsed = schema.safeParse({
    emails,
    lowStockThreshold: Number(formData.get("lowStockThreshold")),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] === "emails" ? "alertEmails" : String(issue.path[0]);
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const on = (name: string) => formData.get(name) === "on";
  const values = {
    alertEmails: parsed.data.emails.join(", ") || null,
    lowStockThreshold: parsed.data.lowStockThreshold,
    alertLowStock: on("alertLowStock"),
    alertOutOfStock: on("alertOutOfStock"),
    alertFailedDelivery: on("alertFailedDelivery"),
    alertPaymentProblem: on("alertPaymentProblem"),
    alertNewOrder: on("alertNewOrder"),
    updatedBy: admin.user.email,
  };
  await prisma.storeSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...values },
    update: values,
  });

  // A new threshold may put products into (or out of) "low": re-check all.
  const products = await prisma.product.findMany({ select: { id: true } });
  await checkStockAlerts(products.map((p) => p.id));

  revalidatePath("/admin", "layout");
  return { ok: true, message: "Alert settings saved." };
}

export async function sendTestAlert(): Promise<AlertSettingsResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Not authorized." };

  const settings = await getAlertSettings();
  const result = await sendAlert({
    type: "TEST",
    subject: "Test alert",
    lines: [
      `This is a test alert from your Keysby admin panel, sent by ${admin.user.email}.`,
      ``,
      `If you can read this, alert emails are working.`,
    ],
  });
  revalidatePath("/admin/settings");

  if (result === "sent") {
    return { ok: true, message: `Test email sent to ${settings.recipients.join(", ")}.` };
  }
  if (result === "no-recipient") {
    return { ok: false, error: "No recipient: add an alert email above (or set ADMIN_EMAIL)." };
  }
  return { ok: false, error: "Sending failed. Check the SMTP settings; the error is in the alert log below." };
}
