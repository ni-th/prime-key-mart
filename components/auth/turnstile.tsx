"use client";

import { createContext, useContext, useEffect, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * The site key is public by design (the browser needs it), but it's read on
 * the server (TURNSTILE_SITE_KEY) and handed down here, so it needs no
 * NEXT_PUBLIC_ variable and can change without a rebuild.
 */
const SiteKeyContext = createContext("");

export function TurnstileProvider({ siteKey, children }: { siteKey: string; children: React.ReactNode }) {
  return <SiteKeyContext.Provider value={siteKey}>{children}</SiteKeyContext.Provider>;
}

/** False without keys (local dev): forms then skip the check. */
export function useTurnstileOn(): boolean {
  return useContext(SiteKeyContext).length > 0;
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Cloudflare's "are you human" check. Usually passes on its own in a second;
 * suspicious visitors get a small challenge. Puts its token in a hidden
 * `cf-turnstile-response` field of the surrounding form and reports it via
 * `onToken` (null when it expires). Change `resetKey` after every submit:
 * tokens work only once.
 */
export function Turnstile({
  onToken,
  resetKey = 0,
  className,
}: {
  onToken?: (token: string | null) => void;
  resetKey?: number;
  className?: string;
}) {
  const siteKey = useContext(SiteKeyContext);
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const tokenCb = useRef(onToken);
  useEffect(() => {
    tokenCb.current = onToken;
  });

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile || widget.current) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: siteKey,
          theme: "auto",
          size: "flexible",
          callback: (t: string) => tokenCb.current?.(t),
          "expired-callback": () => tokenCb.current?.(null),
          "error-callback": () => tokenCb.current?.(null),
        });
      })
      .catch(() => tokenCb.current?.(null));
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey === 0 || !widget.current || !window.turnstile) return;
    tokenCb.current?.(null);
    window.turnstile.reset(widget.current);
  }, [resetKey]);

  if (!siteKey) return null;
  return <div ref={box} className={className} />;
}
