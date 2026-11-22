"use server";

import { getAdminSession } from "@/lib/admin";
import { EMAIL_SAMPLES } from "@/lib/email/samples";
import { sendRenderedEmail } from "@/lib/mailer";

export type SendTestResult = { ok: true; message: string } | { ok: false; error: string };

/** Send one template (with sample data) to the signed-in admin. */
export async function sendTestEmail(id: string): Promise<SendTestResult> {
  const admin = await getAdminSession();
  if (!admin?.user?.email) return { ok: false, error: "Not authorized." };

  const sample = EMAIL_SAMPLES.find((s) => s.id === id);
  if (!sample) return { ok: false, error: "Unknown email." };

  try {
    const email = sample.render();
    await sendRenderedEmail(admin.user.email, { ...email, subject: `[Test] ${email.subject}` });
    return { ok: true, message: `Sent "${sample.name}" to ${admin.user.email}.` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sending failed." };
  }
}
