"use client";

import { useEffect, useRef } from "react";
import { forgetPendingCheckout, releasePendingCheckout } from "@/lib/pending-checkout";

/**
 * On the cart and checkout pages: if the customer left for PayHere and came
 * back here instead of the success page, release that checkout's keys. Also
 * runs when the page is restored from the back/forward cache (Back button).
 * `onReturn` runs after a release, and on every back/forward restore (so a
 * "Paying..." spinner frozen in the cached page can be reset).
 */
export function ReleaseAbandonedCheckout({ onReturn }: { onReturn?: () => void }) {
  const cb = useRef(onReturn);
  useEffect(() => {
    cb.current = onReturn;
  });

  useEffect(() => {
    const run = async (restored: boolean) => {
      const released = await releasePendingCheckout();
      if (released || restored) cb.current?.();
    };
    void run(false);
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void run(true);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  return null;
}

/** On the success and cancel pages: the checkout is settled, nothing to release. */
export function ForgetPendingCheckout() {
  useEffect(() => {
    forgetPendingCheckout();
  }, []);
  return null;
}
