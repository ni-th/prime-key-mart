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

export function AddKeysForm({ productId, accounts = false }: { productId: string; accounts?: boolean }) {
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
            {accounts ? "Paste accounts - one per line: username, password" : "Paste license keys - one per line"}
          </label>
          <Textarea
            id="raw"
            name="raw"
            rows={6}
            placeholder={
              accounts
                ? "user1@example.com, Passw0rd!\nuser2@example.com, An0ther,pass"
                : "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX\nYYYYY-YYYYY-YYYYY-YYYYY-YYYYY"
            }
            className="font-mono text-sm"
            required
          />
          <p className="text-xs text-muted-foreground">
            {accounts
              ? "Only the first comma separates the username from the password, so passwords may contain commas. Accounts are encrypted; a username that's already in stock is skipped."
              : "Keys are encrypted before they touch the database. Exact duplicates are skipped automatically."}
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
