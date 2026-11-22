"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { saveFreeCheckHours, type FreeCheckState } from "@/app/actions/warranty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
        <div className="space-y-1.5">
          <Label htmlFor="free-check-hours">Hours after delivery</Label>
          <Input
            id="free-check-hours"
            name="hours"
            type="number"
            min={0}
            max={168}
            step={1}
            defaultValue={hours}
            className="w-28"
          />
        </div>
        <Submit />
      </div>
      {state.status === "done" && <p className="text-xs text-success">{state.message}</p>}
      {state.status === "error" && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
