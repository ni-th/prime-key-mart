"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { addLicenseKeys, type FormResult } from "@/app/actions/admin";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Add keys
    </Button>
  );
}

export function AddKeysForm({ productId }: { productId: string }) {
  const [state, formAction] = useActionState<FormResult, FormData>(
    addLicenseKeys,
    { ok: false, error: "" },
  );

  return (
    <Card className="space-y-3 p-5">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="productId" value={productId} />
        <div className="space-y-1.5">
          <label htmlFor="raw" className="text-sm font-medium">
            Paste license keys - one per line
          </label>
          <Textarea
            id="raw"
            name="raw"
            rows={6}
            placeholder={"XXXXX-XXXXX-XXXXX-XXXXX-XXXXX\nYYYYY-YYYYY-YYYYY-YYYYY-YYYYY"}
            className="font-mono text-sm"
            required
          />
          <p className="text-xs text-muted-foreground">
            Keys are encrypted before they touch the database. Exact duplicates
            are skipped automatically.
          </p>
        </div>

        {state.ok && state.message && (
          <Alert>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        {!state.ok && state.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <SubmitButton />
      </form>
    </Card>
  );
}
