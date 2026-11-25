/**
 * A `callbackUrl` from the address bar, made safe to navigate to after
 * sign-in: only paths on this site are allowed. Anything else (another site,
 * "//evil.com", "/\evil.com", "javascript:...") falls back to `fallback`, so
 * a crafted sign-in link can't send customers to a phishing page.
 */
export function safeCallbackUrl(value: string | null | undefined, fallback = "/"): string {
  if (!value || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Control characters or backslashes can be read as a different host by browsers.
  if (/[\u0000-\u001f\\]/.test(value)) return fallback;
  return value;
}
