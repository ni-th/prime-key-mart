"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { saveFreeCheckHours, type FreeCheckState } from "@/app/actions/warranty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Save
    </Button>
  );
}

/** Store-wide "every key can be reported within N hours of delivery". */
export function FreeCheckForm({ hours }: { hours: number }) {
  const [state, action] = useActionState<FreeCheckState, FormData>(saveFreeCheckHours, { status: "idle" });
  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <Field className="w-auto" data-invalid={state.status === "error" || undefined}>
          <FieldLabel htmlFor="free-check-hours" required>
            Hours after delivery
          </FieldLabel>
          <Input
            id="free-check-hours"
            name="hours"
            type="number"
            inputMode="numeric"
            min={0}
            max={168}
            step={1}
            required
            defaultValue={hours}
            aria-invalid={state.status === "error" || undefined}
            className="w-28"
          />
        </Field>
        <Submit />
      </div>
      <FieldDescription className="text-xs">0 to 168 (one week). 0 turns it off.</FieldDescription>
      {state.status === "done" && <p className="text-xs text-success">{state.message}</p>}
      <FieldError className="text-xs">{state.status === "error" ? state.error : null}</FieldError>
    </form>
  );
}
