"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { OtpInput } from "@/components/ui/otp-input";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { EMAIL_MAX, PASSWORD_MAX } from "@/lib/validation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { registerUser, resendSignupCode, verifySignupCode } from "@/app/actions/auth";
import { Turnstile, useTurnstileOn } from "@/components/auth/turnstile";
import { safeCallbackUrl } from "@/lib/safe-redirect";

/** Must match SIGNUP_CODE_RESEND_SECONDS on the server. */
const RESEND_SECONDS = 60;

type Details = { firstName: string; lastName: string; email: string; password: string };

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Only same-site paths: a crafted link must not redirect to another site.
  const callbackUrl = safeCallbackUrl(params.get("callbackUrl"));

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const waitingForCaptcha = useTurnstileOn() && !captcha;

  // Set once the code has been emailed: the form switches to the code step.
  // The password stays in memory only, for the automatic sign-in at the end.
  const [details, setDetails] = useState<Details | null>(null);
  // What they typed, restored when they go back to fix the email.
  const [draft, setDraft] = useState<Omit<Details, "password"> | null>(null);
  const [code, setCode] = useState("");
  // Bumped to clear the code boxes (wrong code, new code sent).
  const [codeAttempt, setCodeAttempt] = useState(0);
  const codeFormRef = useRef<HTMLFormElement>(null);
  const [cooldown, setCooldown] = useState(0);

  function clearCode() {
    setCode("");
    setCodeAttempt((n) => n + 1);
  }

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function fail(result: { error: string; fieldErrors?: Record<string, string> }) {
    setPending(false);
    setNotice(null);
    setError(result.error);
    setFieldErrors(result.fieldErrors ?? {});
  }

  async function onDetails(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (waitingForCaptcha) {
      setError("Please wait for the security check below to finish.");
      return;
    }
    setError(null);
    setFieldErrors({});
    setPending(true);

    const data = new FormData(e.currentTarget);
    const payload: Details = {
      firstName: String(data.get("firstName") ?? ""),
      lastName: String(data.get("lastName") ?? ""),
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
    };

    const result = await registerUser(payload, captcha);
    // Turnstile tokens work once; get a fresh one either way.
    setCaptchaReset((n) => n + 1);
    if (!result.ok) return fail(result);

    setPending(false);
    setDetails({ ...payload, email: result.email });
    clearCode();
    setCooldown(RESEND_SECONDS);
    setNotice(null);
  }

  async function onCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!details || pending || code.length !== 6) return;
    setError(null);
    setFieldErrors({});
    setPending(true);

    const result = await verifySignupCode({ email: details.email, code });
    if (!result.ok) {
      clearCode();
      return fail(result);
    }

    const res = await signIn("credentials", {
      email: details.email,
      password: details.password,
      ticket: result.ticket,
      redirect: false,
    });
    setPending(false);

    if (!res || res.error) {
      // Account was created but auto sign-in failed - send them to login.
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  async function onResend() {
    if (!details || cooldown > 0) return;
    setError(null);
    setFieldErrors({});
    setPending(true);
    const result = await resendSignupCode(details.email);
    if (!result.ok) return fail(result);
    setPending(false);
    clearCode();
    setCooldown(RESEND_SECONDS);
    setNotice("We sent a new code. Codes from earlier emails no longer work.");
  }

  function startOver() {
    if (details) setDraft({ firstName: details.firstName, lastName: details.lastName, email: details.email });
    setDetails(null);
    setError(null);
    setNotice(null);
    setFieldErrors({});
  }

  const errorBox = error && (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );

  if (details) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a 6-digit code to <span className="font-medium text-foreground">{details.email}</span>.
            Enter it to finish creating your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={codeFormRef} onSubmit={onCode} className="space-y-4">
            {errorBox}
            {notice && (
              <Alert>
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            )}
            <Field data-invalid={Boolean(fieldErrors.code) || undefined}>
              <FieldLabel htmlFor="code" required>
                Code
              </FieldLabel>
              <OtpInput
                key={codeAttempt}
                className="justify-center"
                id="code"
                name="code"
                autoFocus
                disabled={pending}
                invalid={Boolean(fieldErrors.code)}
                onChange={setCode}
                // Submit as soon as the 6th digit is entered.
                onComplete={() => codeFormRef.current?.requestSubmit()}
              />
              <FieldError>{fieldErrors.code}</FieldError>
              <FieldDescription>
                Can&apos;t find it? Check your spam folder. The code expires in 15 minutes.
              </FieldDescription>
            </Field>
            <Button type="submit" className="w-full" disabled={pending || code.length !== 6}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Create account
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={startOver}
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              Use a different email
            </button>
            <button
              type="button"
              onClick={onResend}
              disabled={pending || cooldown > 0}
              className="font-medium text-foreground hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign up</CardTitle>
        <CardDescription>
          Keep every key you buy in one place.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onDetails} className="space-y-4">
          {errorBox}
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(fieldErrors.firstName) || undefined}>
                <FieldLabel htmlFor="firstName" required>
                  First name
                </FieldLabel>
                <Input
                  id="firstName"
                  name="firstName"
                  autoComplete="given-name"
                  defaultValue={draft?.firstName}
                  maxLength={50}
                  required
                  aria-invalid={Boolean(fieldErrors.firstName) || undefined}
                />
                <FieldError>{fieldErrors.firstName}</FieldError>
              </Field>
              <Field data-invalid={Boolean(fieldErrors.lastName) || undefined}>
                <FieldLabel htmlFor="lastName" required>
                  Last name
                </FieldLabel>
                <Input
                  id="lastName"
                  name="lastName"
                  autoComplete="family-name"
                  defaultValue={draft?.lastName}
                  maxLength={50}
                  required
                  aria-invalid={Boolean(fieldErrors.lastName) || undefined}
                />
                <FieldError>{fieldErrors.lastName}</FieldError>
              </Field>
            </div>
            <Field data-invalid={Boolean(fieldErrors.email) || undefined}>
              <FieldLabel htmlFor="email" required>
                Email
              </FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={draft?.email}
                maxLength={EMAIL_MAX}
                required
                aria-invalid={Boolean(fieldErrors.email) || undefined}
              />
              <FieldError>{fieldErrors.email}</FieldError>
              <FieldDescription>We&apos;ll email you a code to confirm it.</FieldDescription>
            </Field>
            <Field data-invalid={Boolean(fieldErrors.password) || undefined}>
              <FieldLabel htmlFor="password" required>
                Password
              </FieldLabel>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={PASSWORD_MAX}
                aria-invalid={Boolean(fieldErrors.password) || undefined}
              />
              <FieldError>{fieldErrors.password}</FieldError>
              <FieldDescription>At least 8 characters.</FieldDescription>
            </Field>
          </FieldGroup>
          <Turnstile onToken={setCaptcha} resetKey={captchaReset} />
          <Button type="submit" className="w-full" disabled={pending || waitingForCaptcha}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Continue
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="font-medium text-foreground hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
