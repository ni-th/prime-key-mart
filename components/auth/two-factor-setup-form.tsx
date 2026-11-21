"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { confirmTwoFactor, type TwoFactorState } from "@/app/actions/two-factor";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

function Submit({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending || !ready}>
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
  const [code, setCode] = useState("");

  return (
    <form action={action} className="space-y-3">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="code">6-digit code</Label>
        <OtpInput
          className="justify-center"
          id="code"
          name="code"
          autoFocus
          invalid={state.error !== null}
          onChange={setCode}
        />
      </div>
      <Submit ready={code.length === 6} />
      <p className="text-xs text-muted-foreground">
        You&apos;ll be signed out and asked to sign in again with a code.
      </p>
    </form>
  );
}
