import crypto from "node:crypto";

/**
 * Cloudflare Turnstile (free, privacy-friendly CAPTCHA) for sign-in, sign-up
 * and "forgot password". Most people never see a puzzle: it checks the
 * browser silently and only challenges suspicious traffic.
 *
 * Set TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY to turn it on.
 * Without them (local dev) every check passes; rate limits still apply.
 */
const SECRET = process.env.TURNSTILE_SECRET_KEY ?? "";
const SITE_KEY = process.env.TURNSTILE_SITE_KEY ?? "";

export const turnstileEnabled = SECRET.length > 0 && SITE_KEY.length > 0;

/** For the browser widget (public by design); empty when the check is off. */
export function turnstileSiteKey(): string {
  return turnstileEnabled ? SITE_KEY : "";
}

if (!turnstileEnabled && process.env.NODE_ENV === "production") {
  console.warn("[turnstile] Not configured: sign-in and sign-up have no bot check (rate limits only).");
}

/** Field name the widget adds to the surrounding form. */
export const TURNSTILE_FIELD = "cf-turnstile-response";

/**
 * Ask Cloudflare whether this token is a real, unused human check.
 * If Cloudflare can't be reached we let the request through (rate limits
 * still protect us) rather than locking every customer out.
 */
export async function verifyTurnstile(token: string | null | undefined, ip?: string | null): Promise<boolean> {
  if (!turnstileEnabled) return true;
  if (!token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret: SECRET, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[turnstile] verification unavailable, allowing request", err);
    return true;
  }
}

/* ---------- Sign in right after sign-up ---------- */

// Turnstile tokens work once, and sign-up already used it. Sign-up hands back
// this short-lived ticket so the automatic sign-in that follows doesn't need a
// second check.

const TICKET_SECONDS = 120;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

export function signSignupTicket(email: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + TICKET_SECONDS;
  const mac = crypto.createHmac("sha256", secret()).update(`signup:${email.toLowerCase()}:${exp}`).digest("base64url");
  return `${exp}.${mac}`;
}

export function verifySignupTicket(ticket: string | null | undefined, email: string): boolean {
  if (!ticket) return false;
  const [expRaw, mac] = ticket.split(".");
  const exp = Number(expRaw);
  if (!mac || !Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const expected = Buffer.from(
    crypto.createHmac("sha256", secret()).update(`signup:${email.toLowerCase()}:${expRaw}`).digest("base64url"),
  );
  const given = Buffer.from(mac);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
