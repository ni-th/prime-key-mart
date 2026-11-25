"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, MailCheck } from "lucide-react";
import {
  requestPasswordReset,
  type ForgotPasswordState,
} from "@/app/actions/password-reset";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { EMAIL_MAX } from "@/lib/validation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Turnstile, useTurnstileOn } from "@/components/auth/turnstile";

function Submit({ blocked }: { blocked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending || blocked}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Send reset link
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ForgotPasswordState, FormData>(
    requestPasswordReset,
    { status: "idle" },
  );
  const turnstileOn = useTurnstileOn();
  const [captcha, setCaptcha] = useState<string | null>(null);
  // Each new result means the token was used: the widget gets a fresh one.
  const [captchaReset, setCaptchaReset] = useState(0);
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    setCaptchaReset((n) => n + 1);
  }

  if (state.status === "sent") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailCheck className="size-5 text-primary" />
            Check your email
          </CardTitle>
          <CardDescription>
            If an account exists for <strong>{state.email}</strong>, we&apos;ve
            sent a link to reset your password. It expires in 30 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Don&apos;t see it? Check your spam folder, or wait a minute and try again.</p>
          <Link href="/login" className="font-medium text-foreground hover:underline">
            ← Back to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot your password?</CardTitle>
        <CardDescription>
          Enter your account email and we&apos;ll send you a link to choose a new
          one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state.status === "error" && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <Field>
            <FieldLabel htmlFor="email" required>
              Email
            </FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={EMAIL_MAX}
              required
              autoFocus
            />
          </Field>
          {/* Puts its token in the form as cf-turnstile-response. */}
          <Turnstile onToken={setCaptcha} resetKey={captchaReset} />
          <Submit blocked={turnstileOn && !captcha} />
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
