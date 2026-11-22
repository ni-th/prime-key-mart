"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { resolveWarrantyClaim, type ClaimResult } from "@/app/actions/warranty-claims";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Action = "replace" | "refund" | "reject";

const ACTIONS: { value: Action; label: string; hint: string; placeholder: string }[] = [
  {
    value: "replace",
    label: "Send replacement",
    hint: "A new key from stock is emailed to the customer. The old key is marked replaced.",
    placeholder: "Optional note, e.g. Sorry about that! Here's a fresh key.",
  },
  {
    value: "refund",
    label: "Refund this key",
    hint: "Refunds only this key, not the whole order. Records the amount; return it in PayHere yourself (partial refund).",
    placeholder: "Optional note, e.g. We're out of replacement keys, so we've refunded you.",
  },
  {
    value: "reject",
    label: "Not covered",
    hint: "Closes the claim. Your message explains why (required).",
    placeholder: "e.g. The key was activated on a different edition of Windows, which the warranty doesn't cover.",
  },
];

function Submit({ action }: { action: Action }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={action === "reject" ? "outline" : "default"} disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {ACTIONS.find((a) => a.value === action)!.label} and email customer
    </Button>
  );
}

/** Close an open warranty claim: replace, refund or reject, with a note to the customer. */
export function ResolveClaimForm({
  claimId,
  keyPaid,
  currency,
}: {
  claimId: string;
  /** What the customer paid for this key, e.g. "1250.00" (price + warranty fee). */
  keyPaid: string;
  currency: string;
}) {
  const [state, formAction] = useActionState<ClaimResult | null, FormData>(resolveWarrantyClaim, null);
  const [action, setAction] = useState<Action>("replace");
  const current = ACTIONS.find((a) => a.value === action)!;

  if (state?.ok) {
    return (
      <Alert>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="claimId" value={claimId} />
      <input type="hidden" name="action" value={action} />
      {state && !state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Resolution">
        {ACTIONS.map((a) => (
          <button
            key={a.value}
            type="button"
            role="radio"
            aria-checked={action === a.value}
            onClick={() => setAction(a.value)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium",
              action === a.value ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {a.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{current.hint}</p>
      {action === "refund" && (
        <div className="space-y-1.5">
          <Label htmlFor={`refund-${claimId}`}>Refund amount ({currency})</Label>
          <Input
            id={`refund-${claimId}`}
            name="refundAmount"
            inputMode="decimal"
            defaultValue={keyPaid}
            className="max-w-40"
          />
          <p className="text-xs text-muted-foreground">
            The customer paid {currency} {keyPaid} for this key. Lower it for a partial refund.
          </p>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`note-${claimId}`}>Message to the customer</Label>
        <Textarea
          id={`note-${claimId}`}
          name="note"
          rows={3}
          maxLength={1000}
          required={action === "reject"}
          minLength={action === "reject" ? 10 : undefined}
          placeholder={current.placeholder}
        />
      </div>
      <Submit action={action} />
    </form>
  );
}
