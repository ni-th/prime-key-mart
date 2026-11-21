"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/account";

  const justEnabled = params.get("twofa") === "enabled";

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Second step for admins with an authenticator app. Email and password stay
  // in the (hidden) inputs so they're sent again together with the code.
  const [needsCode, setNeedsCode] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const data = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
      code: needsCode ? String(data.get("code") ?? "") : "",
      redirect: false,
    });

    setPending(false);
    if (!res || res.error) {
      if (res?.code === "totp_required") {
        setNeedsCode(true);
      } else if (res?.code === "totp_invalid") {
        setNeedsCode(true);
        setError("That code didn't work. Wait for a new code and try again.");
      } else {
        setNeedsCode(false);
        setError("Wrong email or password.");
      }
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Access your orders and license keys.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {justEnabled && !error && !needsCode && (
            <Alert>
              <AlertDescription>
                Two-factor is on. Sign in again with your authenticator code.
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {needsCode && (
            <div className="space-y-1.5">
              <Label htmlFor="code">Authenticator code</Label>
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
              <p className="text-xs text-muted-foreground">
                Open your authenticator app and enter the 6-digit code for
                KeyMart.
              </p>
            </div>
          )}
          <div className={needsCode ? "hidden" : "space-y-1.5"}>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className={needsCode ? "hidden" : "space-y-1.5"}>
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {needsCode ? "Verify" : "Sign in"}
          </Button>
          {needsCode && (
            <button
              type="button"
              onClick={() => {
                setNeedsCode(false);
                setError(null);
              }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Use a different account
            </button>
          )}
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link
            href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="font-medium text-foreground hover:underline"
          >
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
