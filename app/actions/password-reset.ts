"use server";

import bcrypt from "bcryptjs";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import {
  RESET_TTL_MINUTES,
  consumeResetToken,
  createPasswordResetToken,
  findValidResetToken,
} from "@/lib/password-reset";
import { sendPasswordChangedEmail, sendPasswordResetEmail } from "@/lib/mailer";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { TURNSTILE_FIELD, verifyTurnstile } from "@/lib/turnstile";

const SITE_URL = process.env.SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export type ForgotPasswordState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; error: string };

/**
 * Step 1: email a reset link. The response is identical whether or not the
 * account exists (and the email is sent after the response via `after`, so
 * timing doesn't give it away either) - the form can't be used to discover
 * which emails are registered. Repeated requests are silently rate-limited.
 */
export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", error: "Enter a valid email address." };
  }
  const email = parsed.data.email.toLowerCase();

  const ip = await clientIp();
  if (!(await verifyTurnstile(formData.get(TURNSTILE_FIELD) as string | null, ip))) {
    return { status: "error", error: "The security check failed. Please try again." };
  }
  // Stops one network from spamming reset emails to many addresses.
  if (!(await rateLimit(`reset-ip:${ip}`, 10, 3600))) {
    return { status: "error", error: "Too many requests from your network. Please try again in an hour." };
  }

  after(async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, passwordHash: true, suspended: true },
      });
      // No account, no password to reset, or suspended: send nothing.
      if (!user?.passwordHash || user.suspended) return;

      const token = await createPasswordResetToken(user.id);
      if (!token) return; // rate-limited

      const url = `${SITE_URL}/reset-password?token=${encodeURIComponent(token)}`;
      await sendPasswordResetEmail(user.email, url, RESET_TTL_MINUTES);
    } catch (err) {
      console.error("[password-reset] sending reset email failed", err);
    }
  });

  return { status: "sent", email };
}

export type ResetPasswordState =
  | { status: "idle" }
  | { status: "done" }
  | { status: "error"; error: string; fieldErrors?: Record<string, string> };

/** Step 2: set the new password from a valid, unused link. */
export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", error: "Please fix the highlighted fields.", fieldErrors };
  }

  const token = await findValidResetToken(parsed.data.token);
  if (!token) {
    return {
      status: "error",
      error: "This reset link is invalid or has expired. Request a new one.",
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const ok = await consumeResetToken(token.id, token.userId, passwordHash);
  if (!ok) {
    return {
      status: "error",
      error: "This reset link has already been used. Request a new one.",
    };
  }

  after(async () => {
    try {
      await sendPasswordChangedEmail(token.user.email);
    } catch (err) {
      console.error("[password-reset] sending changed-password email failed", err);
    }
  });

  return { status: "done" };
}
