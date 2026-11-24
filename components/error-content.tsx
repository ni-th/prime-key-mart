"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Copy, Loader2, RotateCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusPage } from "@/components/status-page";
import { cn } from "@/lib/utils";

type Area = "shop" | "account" | "admin";

const HOME: Record<Area, { href: string; label: string }> = {
  shop: { href: "/", label: "Go to the store" },
  account: { href: "/account", label: "My account" },
  admin: { href: "/admin", label: "Admin dashboard" },
};

/**
 * Shared body of the error pages. Shows the error reference (digest), which
 * matches the server log entry, so a customer can quote it to support.
 * In development the real message is shown too.
 */
export function ErrorContent({
  error,
  retry,
  area = "shop",
}: {
  error: unknown;
  retry: () => void;
  area?: Area;
}) {
  // The error we pressed "Try again" for: if the retry fails, a new error
  // object arrives and the spinner stops on its own.
  const [retriedFor, setRetriedFor] = useState<unknown>(null);
  const retrying = retriedFor !== null && retriedFor === error;
  const [copied, setCopied] = useState(false);
  const digest =
    error && typeof error === "object" && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;
  const devMessage =
    process.env.NODE_ENV === "development" && error instanceof Error ? error.message : null;

  useEffect(() => {
    console.error(error);
  }, [error]);

  const home = HOME[area];

  return (
    <StatusPage code="500" icon={<AlertTriangle className="size-6" />} title="Something went wrong">
      <p className="mx-auto max-w-sm">
        {area === "admin"
          ? "This admin page hit an error. Try again; if it keeps happening, look up the reference below in the server logs."
          : "Sorry, something broke on our side. Please try again in a moment. If it keeps happening, contact us and mention the reference below."}
      </p>

      {devMessage && (
        <pre className="mx-auto max-w-md overflow-x-auto rounded-md border bg-muted/50 p-3 text-left text-xs text-destructive">
          {devMessage}
        </pre>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <Button
          size="sm"
          disabled={retrying}
          onClick={() => {
            setRetriedFor(error);
            retry();
          }}
        >
          {retrying ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
          Try again
        </Button>
        <Link href={home.href} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          {home.label}
        </Link>
        {area !== "admin" && (
          <Link href="/contact" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Contact us
          </Link>
        )}
      </div>

      {digest && (
        <p className="flex items-center justify-center gap-1.5 text-xs">
          <span>
            Error reference: <code className="font-mono text-foreground">{digest}</code>
          </span>
          <button
            type="button"
            className="rounded p-1 hover:bg-muted"
            aria-label="Copy error reference"
            onClick={() => {
              navigator.clipboard?.writeText(digest).then(
                () => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                },
                () => {},
              );
            }}
          >
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          </button>
        </p>
      )}
    </StatusPage>
  );
}
