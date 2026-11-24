"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { StatusPage } from "@/components/status-page";
import "./globals.css";

/**
 * Only for errors in the root layout itself (everything else is caught by an
 * error.tsx). It replaces the whole document, so it brings its own <html>,
 * styles and theme, and avoids anything that could depend on the broken layout.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest =
    error && typeof error === "object" && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;

  useEffect(() => {
    console.error(error);
    // No theme provider here: follow the device setting.
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark");
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <title>Something went wrong</title>
        <StatusPage code="500" icon={<AlertTriangle className="size-6" />} title="Something went wrong">
          <p className="mx-auto max-w-sm">
            The store couldn&apos;t load. Please try again in a moment.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <RotateCw className="size-4" />
              Try again
            </button>
            {/* A full page load, not client navigation: the app shell is what broke. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium hover:bg-muted"
            >
              Go to the store
            </a>
          </div>
          {digest && (
            <p className="text-xs">
              Error reference: <code className="font-mono text-foreground">{digest}</code>
            </p>
          )}
        </StatusPage>
      </body>
    </html>
  );
}
