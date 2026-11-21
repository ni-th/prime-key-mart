"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { confirmTwoFactor, type TwoFactorState } from "@/app/actions/two-factor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Turn on two-factor
    </Button>
  );
}

export function TwoFactorSetupForm() {
  const [state, action] = useActionState<TwoFactorState, FormData>(
    confirmTwoFactor,
    { error: null },
  );

  return (
    <form action={action} className="space-y-3">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="code">6-digit code</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="123456"
          required
          autoFocus
        />
      </div>
      <Submit />
      <p className="text-xs text-muted-foreground">
        You&apos;ll be signed out and asked to sign in again with a code.
      </p>
    </form>
  );
}
