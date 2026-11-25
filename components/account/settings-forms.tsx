"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  beginTwoFactorSetup,
  cancelTwoFactorSetup,
  changePassword,
  confirmTwoFactorSetup,
  disableTwoFactor,
  updateProfile,
  type AccountFormState,
} from "@/app/actions/account";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { PasswordInput } from "@/components/ui/password-input";
import { PASSWORD_MAX } from "@/lib/validation";

const IDLE: AccountFormState = { status: "idle" };

function Submit({ children, disabled, variant }: { children: React.ReactNode; disabled?: boolean; variant?: "default" | "outline" | "destructive" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending || disabled}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </Button>
  );
}

function Status({ state }: { state: AccountFormState }) {
  if (state.status === "done") {
    return (
      <Alert>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  if (state.status === "error") {
    return (
      <Alert variant="destructive">
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

/** The server's message for one field, if any. */
function errorFor(state: AccountFormState, name: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[name] : undefined;
}

export function ProfileForm({
  firstName,
  lastName,
  email,
}: {
  firstName: string;
  lastName: string;
  email: string;
}) {
  const [state, action] = useActionState(updateProfile, IDLE);
  const err = (n: string) => errorFor(state, n);
  return (
    <form action={action} className="space-y-4">
      <Status state={state} />
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(err("firstName")) || undefined}>
            <FieldLabel htmlFor="firstName" required>
              First name
            </FieldLabel>
            <Input
              id="firstName"
              name="firstName"
              defaultValue={firstName}
              maxLength={50}
              required
              autoComplete="given-name"
              aria-invalid={Boolean(err("firstName")) || undefined}
            />
            <FieldError>{err("firstName")}</FieldError>
          </Field>
          <Field data-invalid={Boolean(err("lastName")) || undefined}>
            <FieldLabel htmlFor="lastName" required>
              Last name
            </FieldLabel>
            <Input
              id="lastName"
              name="lastName"
              defaultValue={lastName}
              maxLength={50}
              required
              autoComplete="family-name"
              aria-invalid={Boolean(err("lastName")) || undefined}
            />
            <FieldError>{err("lastName")}</FieldError>
          </Field>
        </div>
        <FieldDescription className="-mt-3">Used for your payment details at checkout.</FieldDescription>
        <Field data-disabled>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" value={email} disabled readOnly />
          <FieldDescription>Your keys and receipts go to this address. To change it, contact us.</FieldDescription>
        </Field>
      </FieldGroup>
      <Submit>Save name</Submit>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, IDLE);
  const err = (n: string) => errorFor(state, n);
  // Clear the fields after a successful change by remounting them.
  const formKey = state.status === "done" ? state.message : "form";
  return (
    <form action={action} className="space-y-4" key={formKey}>
      <Status state={state} />
      <FieldGroup>
        <Field data-invalid={Boolean(err("current")) || undefined}>
          <FieldLabel htmlFor="current" required>
            Current password
          </FieldLabel>
          <PasswordInput
            id="current"
            name="current"
            required
            maxLength={PASSWORD_MAX}
            autoComplete="current-password"
            aria-invalid={Boolean(err("current")) || undefined}
          />
          <FieldError>{err("current")}</FieldError>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(err("password")) || undefined}>
            <FieldLabel htmlFor="password" required>
              New password
            </FieldLabel>
            <PasswordInput
              id="password"
              name="password"
              required
              minLength={8}
              maxLength={PASSWORD_MAX}
              autoComplete="new-password"
              aria-invalid={Boolean(err("password")) || undefined}
            />
            {err("password") ? (
              <FieldError>{err("password")}</FieldError>
            ) : (
              <FieldDescription>At least 8 characters.</FieldDescription>
            )}
          </Field>
          <Field data-invalid={Boolean(err("confirm")) || undefined}>
            <FieldLabel htmlFor="confirm" required>
              Repeat new password
            </FieldLabel>
            <PasswordInput
              id="confirm"
              name="confirm"
              required
              maxLength={PASSWORD_MAX}
              autoComplete="new-password"
              aria-invalid={Boolean(err("confirm")) || undefined}
            />
            <FieldError>{err("confirm")}</FieldError>
          </Field>
        </div>
      </FieldGroup>
      <Submit>Change password</Submit>
    </form>
  );
}

/** Two-step sign-in: off, being set up (QR shown), or on. */
export function TwoFactorSection({
  enabled,
  isAdmin,
  setup,
}: {
  enabled: boolean;
  isAdmin: boolean;
  /** Present while setting up: the QR (SVG) and the key to type manually. */
  setup: { qrSvg: string; secret: string; email: string } | null;
}) {
  if (enabled) return isAdmin ? <AdminNote /> : <DisableTwoFactor />;
  if (setup) return <SetupTwoFactor {...setup} />;
  return (
    <form action={beginTwoFactorSetup} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Add a code from an authenticator app (Google Authenticator, Authy, 1Password) when you sign in.
        Even if someone learns your password, they can&apos;t open your account or see your keys.
      </p>
      <Submit variant="outline">Set up two-step sign-in</Submit>
    </form>
  );
}

function AdminNote() {
  return (
    <p className="flex items-center gap-2 text-sm">
      <ShieldCheck className="size-4 text-success" />
      On. Required for admin accounts.
    </p>
  );
}

function SetupTwoFactor({ qrSvg, secret, email }: { qrSvg: string; secret: string; email: string }) {
  const [state, action] = useActionState(confirmTwoFactorSetup, IDLE);
  const [code, setCode] = useState("");
  return (
    <div className="space-y-4 text-sm">
      <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
        <li>Open your authenticator app and tap +.</li>
        <li>Scan this QR code.</li>
        <li>Enter the 6-digit code it shows.</li>
      </ol>
      {/* White tile so the code scans in dark mode too. SVG is generated server-side from our own otpauth URI. */}
      <div
        className="w-44 rounded-lg bg-white p-2"
        role="img"
        aria-label="QR code for your authenticator app"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <details className="text-muted-foreground">
        <summary className="cursor-pointer">Can&apos;t scan? Enter this key</summary>
        <code className="mt-2 block break-all rounded bg-muted px-2 py-1.5 font-mono text-xs text-foreground">
          {secret.match(/.{1,4}/g)?.join(" ")}
        </code>
        <p className="mt-1 text-xs">Account: {email} · Time-based</p>
      </details>
      <form action={action} className="space-y-3">
        <Status state={state} />
        <Field data-invalid={state.status === "error" || undefined}>
          <FieldLabel htmlFor="setup-code" required>
            6-digit code
          </FieldLabel>
          <OtpInput id="setup-code" name="code" invalid={state.status === "error"} onChange={setCode} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Submit disabled={code.length !== 6}>Turn on</Submit>
          <Button type="submit" size="sm" variant="ghost" formAction={cancelTwoFactorSetup} formNoValidate>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

function DisableTwoFactor() {
  const [state, action] = useActionState(disableTwoFactor, IDLE);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  return (
    <div className="space-y-3 text-sm">
      <p className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-success" />
        On. You&apos;ll be asked for a code from your app when you sign in.
      </p>
      {!open ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          Turn off
        </Button>
      ) : (
        <form action={action} className="space-y-3 rounded-lg border p-3">
          <Status state={state} />
          <p className="text-xs text-muted-foreground">To turn it off, confirm your password and a current code.</p>
          <FieldGroup className="gap-4">
            <Field data-invalid={Boolean(errorFor(state, "password")) || undefined}>
              <FieldLabel htmlFor="off-password" required>
                Password
              </FieldLabel>
              <PasswordInput
                id="off-password"
                name="password"
                required
                maxLength={PASSWORD_MAX}
                autoComplete="current-password"
                aria-invalid={Boolean(errorFor(state, "password")) || undefined}
              />
              <FieldError>{errorFor(state, "password")}</FieldError>
            </Field>
            <Field data-invalid={state.status === "error" || undefined}>
              <FieldLabel htmlFor="off-code" required>
                6-digit code
              </FieldLabel>
              <OtpInput id="off-code" name="code" invalid={state.status === "error"} onChange={setCode} />
            </Field>
          </FieldGroup>
          <div className="flex gap-2">
            <Submit variant="destructive" disabled={code.length !== 6}>
              Turn off two-step sign-in
            </Submit>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
