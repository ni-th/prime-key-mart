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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpInput } from "@/components/ui/otp-input";
import { PasswordInput } from "@/components/ui/password-input";

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

function FieldError({ state, name }: { state: AccountFormState; name: string }) {
  const msg = state.status === "error" ? state.fieldErrors?.[name] : undefined;
  return msg ? <p className="text-xs text-destructive">{msg}</p> : null;
}

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action] = useActionState(updateProfile, IDLE);
  return (
    <form action={action} className="space-y-4">
      <Status state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={name} maxLength={80} required autoComplete="name" />
        <FieldError state={state} name="name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled readOnly />
        <p className="text-xs text-muted-foreground">
          Your keys and receipts go to this address. To change it, contact us.
        </p>
      </div>
      <Submit>Save name</Submit>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, IDLE);
  // Clear the fields after a successful change by remounting them.
  const formKey = state.status === "done" ? state.message : "form";
  return (
    <form action={action} className="space-y-4" key={formKey}>
      <Status state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="current">Current password</Label>
        <PasswordInput id="current" name="current" required autoComplete="current-password" />
        <FieldError state={state} name="current" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <PasswordInput id="password" name="password" required minLength={8} autoComplete="new-password" />
          <FieldError state={state} name="password" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Repeat new password</Label>
          <PasswordInput id="confirm" name="confirm" required autoComplete="new-password" />
          <FieldError state={state} name="confirm" />
        </div>
      </div>
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
        <div className="space-y-1.5">
          <Label htmlFor="setup-code">6-digit code</Label>
          <OtpInput id="setup-code" name="code" invalid={state.status === "error"} onChange={setCode} />
        </div>
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
          <div className="space-y-1.5">
            <Label htmlFor="off-password">Password</Label>
            <PasswordInput id="off-password" name="password" required autoComplete="current-password" />
            <FieldError state={state} name="password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="off-code">6-digit code</Label>
            <OtpInput id="off-code" name="code" invalid={state.status === "error"} />
          </div>
          <div className="flex gap-2">
            <Submit variant="destructive">Turn off two-step sign-in</Submit>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
