"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { saveMaintenance, type SettingsResult } from "@/app/actions/settings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Save({ turningOn, changed }: { turningOn: boolean; changed: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={turningOn && changed ? "destructive" : "default"}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {turningOn && changed ? "Close the store" : "Save"}
    </Button>
  );
}

export function MaintenanceForm({ on, message }: { on: boolean; message: string | null }) {
  const [state, action] = useActionState<SettingsResult | null, FormData>(saveMaintenance, null);
  const [enabled, setEnabled] = useState(on);
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={action} className="space-y-5">
      {state && (
        <Alert variant={state.ok ? "default" : "destructive"}>
          <AlertDescription>{state.ok ? state.message : state.error}</AlertDescription>
        </Alert>
      )}

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="maintenanceMode"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 size-4"
        />
        <span>
          <span className="font-medium">Maintenance mode</span>
          <span className="block text-xs text-muted-foreground">
            Customers see a &ldquo;We&apos;ll be right back&rdquo; page and can&apos;t place orders. Payments
            already in progress still complete, and customers can still open their orders and keys.
            You (as an admin) can keep browsing the shop to check it.
          </span>
        </span>
      </label>

      <div className="space-y-1.5">
        <Label htmlFor="maintenanceMessage">Message for customers (optional)</Label>
        <Input
          id="maintenanceMessage"
          name="maintenanceMessage"
          maxLength={300}
          defaultValue={message ?? ""}
          placeholder="e.g. We're updating our stock. Back by 6 pm."
          aria-invalid={fe.maintenanceMessage ? true : undefined}
        />
        {fe.maintenanceMessage && <p className="text-xs text-destructive">{fe.maintenanceMessage}</p>}
      </div>

      <Save turningOn={enabled} changed={enabled !== on} />
    </form>
  );
}
