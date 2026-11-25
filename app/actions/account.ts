"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { auth, unstable_update } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { generateTotpSecret, openTotpSecret, sealTotpSecret, verifyTotp } from "@/lib/totp";
import { LINK_TTL_HOURS, countGuestOrders, signLinkToken } from "@/lib/account-link";
import { sendConfirmEmailEmail, sendPasswordChangedEmail } from "@/lib/mailer";
import { PASSWORD_MAX, personNameSchema, registerSchema } from "@/lib/validation";
import { fullName } from "@/lib/signup-code";

const SITE_URL = process.env.SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export type AccountFormState =
  | { status: "idle" }
  | { status: "done"; message: string }
  | { status: "error"; error: string; fieldErrors?: Record<string, string> };

async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}

/* ---------- Profile ---------- */

export async function updateProfile(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await currentUser();
  if (!user) return { status: "error", error: "Please sign in again." };

  const parsed = personNameSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
  });
  if (!parsed.success) {
    return { status: "error", error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const { firstName, lastName } = parsed.data;
  const name = fullName(firstName, lastName);
  await prisma.user.update({ where: { id: user.id }, data: { firstName, lastName, name } });
  // Refresh the name stored in the sign-in session (header, greeting).
  await unstable_update({ user: { name } });
  revalidatePath("/", "layout");
  return { status: "done", message: "Name saved." };
}

/* ---------- Password ---------- */

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password").max(PASSWORD_MAX),
    password: registerSchema.shape.password,
    confirm: z.string().max(PASSWORD_MAX),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don't match" })
  .refine((d) => d.password !== d.current, {
    path: ["password"],
    message: "Use a different password from your current one",
  });

export async function changePassword(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await currentUser();
  if (!user) return { status: "error", error: "Please sign in again." };

  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { status: "error", error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  // Stops guessing the current password from a hijacked session.
  if (!(await rateLimit(`pw-change:${user.id}`, 5, 15 * 60))) {
    return { status: "error", error: "Too many attempts. Wait 15 minutes and try again." };
  }

  if (!user.passwordHash || !(await bcrypt.compare(parsed.data.current, user.passwordHash))) {
    return {
      status: "error",
      error: "Your current password is wrong.",
      fieldErrors: { current: "This isn't your current password" },
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 10) },
  });

  after(async () => {
    try {
      await sendPasswordChangedEmail(user.email);
    } catch (err) {
      console.error("[account] sending password-changed email failed", err);
    }
  });

  return { status: "done", message: "Password changed. We've emailed you a confirmation." };
}

/* ---------- Two-step sign-in (authenticator app) ---------- */

/** Step 1: create a secret to scan. 2FA stays off until a code is confirmed. */
export async function beginTwoFactorSetup(): Promise<void> {
  const user = await currentUser();
  if (!user || user.totpEnabled) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: sealTotpSecret(generateTotpSecret()), totpLastStep: null },
  });
  revalidatePath("/account/settings");
}

/** Abandon a setup that was never confirmed. */
export async function cancelTwoFactorSetup(): Promise<void> {
  const user = await currentUser();
  if (!user || user.totpEnabled) return;
  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: null, totpLastStep: null } });
  revalidatePath("/account/settings");
}

/** Step 2: the code from the app proves it was scanned correctly. */
export async function confirmTwoFactorSetup(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await currentUser();
  if (!user) return { status: "error", error: "Please sign in again." };
  if (user.totpEnabled) return { status: "done", message: "Two-step sign-in is already on." };
  if (!user.totpSecret) return { status: "error", error: "Setup expired. Start again." };

  if (!(await rateLimit(`totp-setup:${user.id}`, 10, 15 * 60))) {
    return { status: "error", error: "Too many attempts. Wait 15 minutes and try again." };
  }

  const step = verifyTotp(openTotpSecret(user.totpSecret), String(formData.get("code") ?? ""));
  if (step === null) {
    return {
      status: "error",
      error: "That code didn't match. Check your phone's time is set automatically and try the newest code.",
    };
  }

  await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true, totpLastStep: step } });
  revalidatePath("/account/settings");
  return { status: "done", message: "Two-step sign-in is on. You'll need a code from your app next time you sign in." };
}

/** Turn it off: needs the password and a current code. Admins can't (it's required for them). */
export async function disableTwoFactor(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await currentUser();
  if (!user) return { status: "error", error: "Please sign in again." };
  if (user.role === "ADMIN") return { status: "error", error: "Admin accounts must keep two-step sign-in on." };
  if (!user.totpEnabled || !user.totpSecret) return { status: "done", message: "Two-step sign-in is already off." };

  if (!(await rateLimit(`totp-off:${user.id}`, 5, 15 * 60))) {
    return { status: "error", error: "Too many attempts. Wait 15 minutes and try again." };
  }

  const password = String(formData.get("password") ?? "").slice(0, PASSWORD_MAX);
  if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return { status: "error", error: "Your password is wrong.", fieldErrors: { password: "Wrong password" } };
  }
  const step = verifyTotp(openTotpSecret(user.totpSecret), String(formData.get("code") ?? ""), user.totpLastStep);
  if (step === null) {
    return { status: "error", error: "That code didn't work. Try the newest code from your app." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null, totpLastStep: null },
  });
  revalidatePath("/account/settings");
  return { status: "done", message: "Two-step sign-in is off." };
}

/* ---------- Link guest orders ---------- */

export type LinkOrdersState = { status: "idle" } | { status: "sent" } | { status: "error"; error: string };

/** Email a "confirm it's you" link that adds this email's guest orders to the account. */
export async function requestOrderLink(): Promise<LinkOrdersState> {
  const user = await currentUser();
  if (!user) return { status: "error", error: "Please sign in again." };

  const count = await countGuestOrders(user.email);
  if (count === 0) return { status: "error", error: "There are no other orders with your email." };

  if (!(await rateLimit(`link-orders:${user.id}`, 3, 3600))) {
    return { status: "error", error: "We've already sent a few emails. Check your inbox (and spam), or try again in an hour." };
  }

  const url = `${SITE_URL}/account/link-orders?t=${encodeURIComponent(signLinkToken(user.id, user.email))}`;
  after(async () => {
    try {
      await sendConfirmEmailEmail(user.email, url, count, LINK_TTL_HOURS);
    } catch (err) {
      console.error("[account] sending confirm-email failed", err);
    }
  });
  return { status: "sent" };
}
