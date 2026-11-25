"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { answerActivation, type ActivationResult } from "@/app/actions/activation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Action = "send" | "reject";

function Submit({ action }: { action: Action }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={action === "reject" ? "outline" : "default"} disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {action === "send" ? "Send Confirmation ID" : "Send reply"}
    </Button>
  );
}

/** Answer an open phone activation request: send the Confirmation ID, or say why not. */
export function AnswerActivationForm({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState<ActivationResult | null, FormData>(answerActivation, null);
  const [action, setAction] = useState<Action>("send");

  if (state?.ok) {
    return (
      <Alert>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="action" value={action} />
      {state && !state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Answer">
        {(
          [
            ["send", "Send Confirmation ID"],
            ["reject", "Can't activate"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={action === value}
            onClick={() => setAction(value)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium",
              action === value ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {action === "send" && (
        <Field>
          <FieldLabel htmlFor={`cid-${requestId}`} required>
            Confirmation ID
          </FieldLabel>
          <Input
            id={`cid-${requestId}`}
            name="confirmationId"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            required
            maxLength={80}
            // 48 digits, with optional spaces or dashes between groups.
            pattern="[0-9\s\-]+"
            title="Digits, spaces and dashes only"
            placeholder="123456-123456-123456-123456-123456-123456-123456-123456"
            className="font-mono"
          />
          <FieldDescription className="text-xs">
            48 digits. Spaces and dashes are fine. It&apos;s emailed to the customer and shown under their key.
          </FieldDescription>
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor={`anote-${requestId}`} required={action === "reject"}>
          Message to the customer{action === "send" ? " (optional)" : ""}
        </FieldLabel>
        <Textarea
          id={`anote-${requestId}`}
          name="note"
          rows={2}
          maxLength={1000}
          required={action === "reject"}
          placeholder={
            action === "send"
              ? "Optional, e.g. Choose 'I have a Confirmation ID' and enter the groups in order."
              : "e.g. The Installation ID is incomplete. Please copy all 9 groups and send it again."
          }
        />
      </Field>
      <Submit action={action} />
    </form>
  );
}
