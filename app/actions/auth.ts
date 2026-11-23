"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { registerSchema, signupCodeSchema } from "@/lib/validation";
import { isEmailBlocked } from "@/lib/moderation";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { signSignupTicket, verifyTurnstile } from "@/lib/turnstile";
import { sendSignupCodeEmail } from "@/lib/mailer";
import {
  SIGNUP_CODE_MAX_ATTEMPTS,
  SIGNUP_CODE_RESEND_SECONDS,
  SIGNUP_CODE_TTL_MINUTES,
  fullName,
  generateSignupCode,
  hashSignupCode,
  signupCodeExpiry,
  signupCodeMatches,
} from "@/lib/signup-code";

/**
 * Sign-up in two steps:
 *   1. registerUser: check the details and email a 6-digit code. Nothing is
 *      created yet except a pending SignupCode row.
 *   2. verifySignupCode: the right code creates the account (email already
 *      confirmed) and hands back a ticket for the automatic sign-in.
 */

type Failure = { ok: false; error: string; fieldErrors?: Record<string, string> };

export type RegisterResult = { ok: true; email: string } | Failure;
export type VerifySignupResult = { ok: true; ticket: string } | Failure;
export type ResendSignupResult = { ok: true } | Failure;

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}

const EMAIL_TAKEN: Failure = {
  ok: false,
  error: "An account with that email already exists.",
  fieldErrors: { email: "This email is already registered." },
};

const SEND_FAILED: Failure = {
  ok: false,
  error: "We couldn't send the code to that address. Check the email and try again.",
};

async function emailCode(email: string, firstName: string, code: string): Promise<boolean> {
  try {
    await sendSignupCodeEmail(email, code, firstName, SIGNUP_CODE_TTL_MINUTES);
    return true;
  } catch (err) {
    console.error("[signup] sending the code failed", err);
    return false;
  }
}

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
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }

  const email = parsed.data.email.toLowerCase();
  const { firstName, lastName } = parsed.data;

  if (await isEmailBlocked(email)) {
    return {
      ok: false,
      error: "This email address can't be used to register. Contact support.",
      fieldErrors: { email: "This email address is not allowed." },
    };
  }

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return EMAIL_TAKEN;

  // Signing up again with the same email replaces the earlier pending sign-up
  // (new details, new code), but not faster than the resend cooldown.
  const pending = await prisma.signupCode.findUnique({ where: { email }, select: { sentAt: true } });
  if (pending && Date.now() - pending.sentAt.getTime() < SIGNUP_CODE_RESEND_SECONDS * 1000) {
    return { ok: false, error: "We just sent a code to this email. Please wait a minute before trying again." };
  }

  const code = generateSignupCode();
  const data = {
    codeHash: hashSignupCode(email, code),
    firstName,
    lastName,
    passwordHash: await bcrypt.hash(parsed.data.password, 10),
    attempts: 0,
    expiresAt: signupCodeExpiry(),
    sentAt: new Date(),
  };
  await prisma.signupCode.upsert({ where: { email }, create: { email, ...data }, update: data });

  // Housekeeping now and then: abandoned sign-ups.
  if (Math.random() < 0.05) {
    await prisma.signupCode
      .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 3_600_000) } } })
      .catch(() => {});
  }

  if (!(await emailCode(email, firstName, code))) {
    await prisma.signupCode.deleteMany({ where: { email } }).catch(() => {});
    return SEND_FAILED;
  }
  return { ok: true, email };
}

export async function verifySignupCode(input: unknown): Promise<VerifySignupResult> {
  const ip = await clientIp();
  if (!(await rateLimit(`signup-verify-ip:${ip}`, 30, 3600))) {
    return { ok: false, error: "Too many attempts. Please try again later." };
  }

  const parsed = signupCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const email = parsed.data.email.toLowerCase();
  const { code } = parsed.data;

  const pending = await prisma.signupCode.findUnique({ where: { email } });
  if (!pending) {
    return { ok: false, error: "This sign-up has expired. Please start again." };
  }
  if (pending.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "That code has expired. Send a new one.", fieldErrors: { code: "Code expired" } };
  }
  if (pending.attempts >= SIGNUP_CODE_MAX_ATTEMPTS) {
    return { ok: false, error: "Too many wrong codes. Send a new one.", fieldErrors: { code: "Send a new code" } };
  }

  if (!signupCodeMatches(email, code, pending.codeHash)) {
    // Count the wrong guess atomically, so parallel requests can't exceed the cap.
    const { count } = await prisma.signupCode.updateMany({
      where: { id: pending.id, codeHash: pending.codeHash, attempts: { lt: SIGNUP_CODE_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    const left = SIGNUP_CODE_MAX_ATTEMPTS - pending.attempts - 1;
    if (count === 0 || left <= 0) {
      return { ok: false, error: "Too many wrong codes. Send a new one.", fieldErrors: { code: "Send a new code" } };
    }
    return {
      ok: false,
      error: `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.`,
      fieldErrors: { code: "Wrong code" },
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Claim the code: only one request can use it.
      const { count } = await tx.signupCode.deleteMany({ where: { id: pending.id, codeHash: pending.codeHash } });
      if (count === 0) throw new Error("code already used");
      await tx.user.create({
        data: {
          email,
          firstName: pending.firstName,
          lastName: pending.lastName,
          name: fullName(pending.firstName, pending.lastName),
          passwordHash: pending.passwordHash,
          role: "USER",
          // They just proved they read this inbox, so guest orders placed with
          // it are linked on their first account visit.
          emailVerifiedAt: new Date(),
        },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return EMAIL_TAKEN;
    return { ok: false, error: "This sign-up has already been used. Try signing in." };
  }

  return { ok: true, ticket: signSignupTicket(email) };
}

export async function resendSignupCode(rawEmail: unknown): Promise<ResendSignupResult> {
  const parsed = signupCodeSchema.shape.email.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };
  const email = parsed.data.toLowerCase();

  const ip = await clientIp();
  if (
    !(await rateLimit(`signup-resend-ip:${ip}`, 10, 3600)) ||
    !(await rateLimit(`signup-resend-email:${email}`, 5, 3600))
  ) {
    return { ok: false, error: "Too many codes sent. Please try again in an hour." };
  }

  const pending = await prisma.signupCode.findUnique({ where: { email } });
  if (!pending) return { ok: false, error: "This sign-up has expired. Please start again." };

  const wait = SIGNUP_CODE_RESEND_SECONDS - Math.floor((Date.now() - pending.sentAt.getTime()) / 1000);
  if (wait > 0) return { ok: false, error: `Please wait ${wait} seconds before asking for a new code.` };

  const code = generateSignupCode();
  await prisma.signupCode.update({
    where: { id: pending.id },
    data: { codeHash: hashSignupCode(email, code), attempts: 0, expiresAt: signupCodeExpiry(), sentAt: new Date() },
  });
  if (!(await emailCode(email, pending.firstName, code))) return SEND_FAILED;
  return { ok: true };
}
