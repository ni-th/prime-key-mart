/**
 * Delivery types and the stored secret format. Client-safe (no secrets here,
 * only parsing and formatting).
 *
 * - KEY: a license key, stored as-is.
 * - ACCOUNT: a username and password, stored (encrypted) as JSON {"u","p"}.
 * - PHONE: a license key activated by phone. The customer sends us the
 *   Installation ID the software shows; we reply with the Confirmation ID.
 */

export const DELIVERY_TYPES = {
  KEY: "License key",
  ACCOUNT: "Account (username and password)",
  PHONE: "Key with phone activation",
} as const;
export type DeliveryType = keyof typeof DELIVERY_TYPES;

export function asDeliveryType(value: unknown): DeliveryType {
  return value === "ACCOUNT" || value === "PHONE" ? value : "KEY";
}

/** Phone activation: requests per key before an admin has to allow more. */
export const ACTIVATION_LIMIT = 3;
/** Shown wherever we promise a reply to a phone activation request. */
export const ACTIVATION_REPLY_TIME = "usually within 2 hours (9am to 9pm)";

export type Secret =
  | { kind: "key"; key: string }
  | { kind: "account"; username: string; password: string };

/** What gets encrypted for an account. */
export function encodeAccount(username: string, password: string): string {
  return JSON.stringify({ u: username, p: password });
}

/** Read a decrypted secret: an account (JSON) or a plain key. */
export function parseSecret(plain: string): Secret {
  if (plain.startsWith('{"u":')) {
    try {
      const o = JSON.parse(plain) as { u?: unknown; p?: unknown };
      if (typeof o.u === "string" && typeof o.p === "string") {
        return { kind: "account", username: o.u, password: o.p };
      }
    } catch {
      // Not JSON after all: treat it as a key.
    }
  }
  return { kind: "key", key: plain };
}

/** One line for admin screens: the key, or "username / password". */
export function secretText(plain: string): string {
  const s = parseSecret(plain);
  return s.kind === "account" ? `${s.username} / ${s.password}` : s.key;
}

/** Short label to tell keys apart: "...KLMNO", or the account username. */
export function secretLabel(plain: string): string {
  const s = parseSecret(plain);
  if (s.kind === "account") return s.username;
  return `...${s.key.replace(/[^A-Za-z0-9]/g, "").slice(-5)}`;
}

/**
 * Parse one pasted account line: "username, password" (a tab or the first
 * colon also works). Only the first separator splits, so passwords may
 * contain commas or colons.
 */
export function parseAccountLine(line: string): { username: string; password: string } | null {
  const m = /^\s*([^,\t:]+?)\s*[,\t:]\s*(\S.*?)\s*$/.exec(line);
  if (!m) return null;
  return { username: m[1], password: m[2] };
}

function group(digits: string, size: number): string {
  return digits.match(new RegExp(`.{1,${size}}`, "g"))?.join("-") ?? digits;
}

/** Installation IDs are 63 digits (9 groups of 7) or 54 (9 groups of 6). */
export function cleanInstallationId(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  return d.length === 63 || d.length === 54 ? d : null;
}

/** Confirmation IDs are 48 digits (8 groups of 6) or 42 (7 groups of 6). */
export function cleanConfirmationId(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  return d.length === 48 || d.length === 42 ? d : null;
}

/** Digits in readable groups, the way Microsoft shows them. */
export function formatActivationId(digits: string): string {
  return group(digits, digits.length === 63 ? 7 : 6);
}

/** "How to activate" text -> steps (one per non-empty line, "1." prefixes removed). */
export function activationStepList(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(\d+[.)]|[-*•])\s*/, "").trim())
    .filter(Boolean);
}
