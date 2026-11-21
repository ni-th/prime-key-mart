import crypto from "node:crypto";
import { decryptSecret, encryptSecret, type EncryptedSecret } from "@/lib/crypto";

/**
 * TOTP (RFC 6238) — the 6-digit codes Google Authenticator, Authy, 1Password
 * etc. show. SHA-1 / 30 seconds / 6 digits is what every authenticator app
 * supports, so those parameters are fixed.
 */
const STEP_SECONDS = 30;
const DIGITS = 6;
/** Accept the previous and next code too, to absorb phone/server clock drift. */
const DRIFT_STEPS = 1;
const ISSUER = "KeyMart";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32 secret");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** HOTP value for one 30-second time-step (RFC 4226 dynamic truncation). */
function codeForStep(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac("sha1", secret).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

/** New random 160-bit secret, base32-encoded (what the authenticator app stores). */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

/** otpauth:// URI encoded in the setup QR code. */
export function totpUri(accountEmail: string, base32Secret: string): string {
  const label = encodeURIComponent(`${ISSUER}:${accountEmail}`);
  const params = new URLSearchParams({
    secret: base32Secret,
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params}`;
}

/**
 * Check a 6-digit code. Returns the matching time-step, or null if the code is
 * wrong. Pass `lastStep` (the last step accepted for this user) to reject a
 * code that was already used — a sniffed code can't be replayed.
 */
export function verifyTotp(
  base32Secret: string,
  code: string,
  lastStep: number | null = null,
  now = Date.now(),
): number | null {
  const candidate = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(candidate)) return null;

  const secret = base32Decode(base32Secret);
  const step = currentStep(now);
  for (let d = -DRIFT_STEPS; d <= DRIFT_STEPS; d++) {
    const s = step + d;
    if (lastStep !== null && s <= lastStep) continue;
    const expected = codeForStep(secret, s);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(candidate))) {
      return s;
    }
  }
  return null;
}

/** For tests: the code an authenticator app would show right now. */
export function totpCodeNow(base32Secret: string, now = Date.now()): string {
  return codeForStep(base32Decode(base32Secret), currentStep(now));
}

// --- Storage: the secret is encrypted at rest like license keys -------------

export function sealTotpSecret(base32Secret: string): string {
  return JSON.stringify(encryptSecret(base32Secret));
}

export function openTotpSecret(stored: string): string {
  return decryptSecret(JSON.parse(stored) as EncryptedSecret);
}
