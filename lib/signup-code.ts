import crypto from "node:crypto";

/**
 * Email check at sign-up: we email a 6-digit code and only create the account
 * once it's entered. Only an HMAC of the code is stored (keyed with
 * AUTH_SECRET), so a database leak doesn't reveal working codes.
 */

/** How long a code works. */
export const SIGNUP_CODE_TTL_MINUTES = 15;
/** Wrong guesses allowed per code before a new one must be sent. */
export const SIGNUP_CODE_MAX_ATTEMPTS = 5;
/** Minimum wait between "send a new code" requests. */
export const SIGNUP_CODE_RESEND_SECONDS = 60;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

/** A random 6-digit code, e.g. "042917". */
export function generateSignupCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashSignupCode(email: string, code: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(`signup-code:${email.toLowerCase()}:${code}`)
    .digest("base64url");
}

export function signupCodeMatches(email: string, code: string, codeHash: string): boolean {
  const expected = Buffer.from(hashSignupCode(email, code));
  const given = Buffer.from(codeHash);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function signupCodeExpiry(now = Date.now()): Date {
  return new Date(now + SIGNUP_CODE_TTL_MINUTES * 60_000);
}

/** "Name Surname" from the two parts. */
export function fullName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}
