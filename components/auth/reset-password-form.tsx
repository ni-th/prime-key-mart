"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { resetPassword, type ResetPasswordState } from "@/app/actions/password-reset";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Set new password
    </Button>
  );
}

export function ResetPasswordForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useActionState<ResetPasswordState, FormData>(
    resetPassword,
    { status: "idle" },
  );

  if (state.status === "done") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
            Password updated
          </CardTitle>
          <CardDescription>
            You can now sign in with your new password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className={cn(buttonVariants(), "w-full")}>
            Sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>For {email}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state.status === "error" && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <input type="hidden" name="token" value={token} />
          {/* Lets password managers save the new password against the account. */}
          <input
            type="email"
            name="username"
            autoComplete="username"
            value={email}
            readOnly
            hidden
          />
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              required
              autoFocus
              aria-invalid={fieldErrors.password ? true : undefined}
            />
            <p
              className={cn(
                "text-xs",
                fieldErrors.password ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {fieldErrors.password ?? "At least 8 characters."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm new password</Label>
            <PasswordInput
              id="confirm"
              name="confirm"
              autoComplete="new-password"
              required
              aria-invalid={fieldErrors.confirm ? true : undefined}
            />
            {fieldErrors.confirm && (
              <p className="text-xs text-destructive">{fieldErrors.confirm}</p>
            )}
          </div>
          <Submit />
        </form>
      </CardContent>
    </Card>
  );
}
