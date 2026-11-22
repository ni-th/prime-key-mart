"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validation";
import { isEmailBlocked } from "@/lib/moderation";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { signSignupTicket, verifyTurnstile } from "@/lib/turnstile";

export type RegisterResult =
  | { ok: true; ticket: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function registerUser(input: unknown, turnstile?: string | null): Promise<RegisterResult> {
  const ip = await clientIp();
  if (!(await verifyTurnstile(turnstile, ip))) {
    return { ok: false, error: "The security check failed. Please try again." };
  }
  // A few sign-ups per network per hour is plenty for real people.
  if (!(await rateLimit(`register-ip:${ip}`, 5, 3600))) {
    return { ok: false, error: "Too many sign-ups from your network. Please try again in an hour." };
  }

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const email = parsed.data.email.toLowerCase();

  if (await isEmailBlocked(email)) {
    return {
      ok: false,
      error: "This email address can't be used to register. Contact support.",
      fieldErrors: { email: "This email address is not allowed." },
    };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      ok: false,
      error: "An account with that email already exists.",
      fieldErrors: { email: "This email is already registered." },
    };
  }

  await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: "USER",
    },
  });

  return { ok: true, ticket: signSignupTicket(email) };
}
