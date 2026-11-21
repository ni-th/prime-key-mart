import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  generateTotpSecret,
  openTotpSecret,
  sealTotpSecret,
  totpUri,
} from "@/lib/totp";
import { signOutForTwoFactor } from "@/app/actions/two-factor";
import { TwoFactorSetupForm } from "@/components/auth/two-factor-setup-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default async function TwoFactorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") redirect("/account");
  if (session.user.mfa) redirect("/admin");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login?callbackUrl=/admin");

  // 2FA is already on, but this session was created before it was (or without
  // the code). Ask for a fresh sign-in, which will prompt for the code.
  if (user.totpEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sign in again</CardTitle>
          <CardDescription>
            Two-factor authentication is on for this account. Sign in again with
            your authenticator code to open the admin panel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signOutForTwoFactor}>
            <Button type="submit" className="w-full">
              Sign in with code
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // First visit: create the secret (kept, not regenerated, until confirmed so a
  // reload doesn't invalidate a QR code that was already scanned).
  let secret: string;
  if (user.totpSecret) {
    secret = openTotpSecret(user.totpSecret);
  } else {
    secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: sealTotpSecret(secret), totpLastStep: null },
    });
  }

  const qrSvg = await QRCode.toString(totpUri(user.email, secret), {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up two-factor authentication</CardTitle>
        <CardDescription>
          Admin accounts need a code from an authenticator app to sign in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Open Google Authenticator (or Authy, 1Password…).</li>
          <li>Tap + and scan this QR code.</li>
          <li>Enter the 6-digit code it shows.</li>
        </ol>

        {/* White tile so the code scans in dark mode too. SVG is generated
            server-side from our own otpauth URI. */}
        <div
          className="mx-auto w-48 rounded-lg bg-white p-2"
          aria-label="QR code for your authenticator app"
          role="img"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />

        <details className="text-muted-foreground">
          <summary className="cursor-pointer">Can&apos;t scan? Enter this key</summary>
          <code className="mt-2 block break-all rounded bg-muted px-2 py-1.5 font-mono text-xs text-foreground">
            {secret.match(/.{1,4}/g)?.join(" ")}
          </code>
          <p className="mt-1 text-xs">Account: {user.email} · Time-based</p>
        </details>

        <TwoFactorSetupForm />
      </CardContent>
    </Card>
  );
}
