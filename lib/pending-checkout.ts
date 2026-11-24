/**
 * Browser-side record of the checkout we just sent to PayHere. If the customer
 * comes back to the store without finishing (no success page), that checkout
 * is released so its keys go back to stock. Client-only; every call is safe
 * when storage is unavailable.
 */
const KEY = "keysby-pending-checkout";

type Pending = { orderNumber: string; token: string | null };

export function rememberPendingCheckout(p: Pending): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Private mode etc.: the hold just expires on its own.
  }
}

export function forgetPendingCheckout(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {}
}

/** Release the remembered checkout (if any) and forget it. True if there was one. */
export async function releasePendingCheckout(): Promise<boolean> {
  let pending: Pending | null = null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    pending = raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return false;
  }
  if (!pending?.orderNumber) return false;
  forgetPendingCheckout();
  await fetch("/api/checkout/release", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(pending),
    keepalive: true,
  }).catch(() => {});
  return true;
}
