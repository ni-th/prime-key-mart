"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Hide a key but keep its last 5 letters/digits, so keys can still be told
 * apart: "ABCDE-FGHIJ-KLMNO" -> "•••••-•••••-KLMNO".
 */
export function maskKey(value: string, visible = 5): string {
  let keep = visible;
  return [...value]
    .reverse()
    .map((ch) => {
      if (!/[A-Za-z0-9]/.test(ch)) return ch;
      if (keep > 0) {
        keep--;
        return ch;
      }
      return "•";
    })
    .reverse()
    .join("");
}

/**
 * A license key, hidden by default (safe to open in a public place). The eye
 * shows it; copy works either way.
 */
export function CopyKey({
  value,
  size = "default",
  hide = "partial",
  what = "Key",
}: {
  value: string;
  size?: "default" | "sm";
  /** partial = keep the last 5 characters; full = hide everything (passwords); none = always shown. */
  hide?: "partial" | "full" | "none";
  /** For labels and toasts: "Key", "Password", "Installation ID"... */
  what?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(hide === "none");
  const masked = hide === "full" ? "•".repeat(10) : maskKey(value);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <code
        className={cn(
          "min-w-0 flex-1 truncate rounded-md bg-muted font-mono",
          size === "sm" ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-sm",
        )}
        aria-label={shown ? undefined : `Hidden ${what.toLowerCase()}`}
      >
        {shown ? value : masked}
      </code>
      {hide !== "none" && (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={shown ? `Hide ${what.toLowerCase()}` : `Show ${what.toLowerCase()}`}
          aria-pressed={shown}
          onClick={() => setShown((s) => !s)}
        >
          {shown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`Copy ${what.toLowerCase()}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            toast.success(`${what} copied`);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            toast.error("Couldn't copy");
          }
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
}

export type KeyGroup = { productName: string; keys: string[] };

export function KeyList({ groups }: { groups: KeyGroup[] }) {
  if (groups.length === 0) {
    return null;
  }
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.productName} className="p-5">
          <div className="mb-3 font-medium">{group.productName}</div>
          <div className="space-y-2">
            {group.keys.map((k) => (
              <CopyKey key={k} value={k} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
