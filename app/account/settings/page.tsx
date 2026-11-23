import type { Metadata } from "next";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { openTotpSecret, totpUri } from "@/lib/totp";
import { Card } from "@/components/ui/card";
import { PasswordForm, ProfileForm, TwoFactorSection } from "@/components/account/settings-forms";

export const metadata: Metadata = { title: "Account settings" };

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-medium">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

export default async function AccountSettingsPage() {
  const session = await auth();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session!.user.id },
    select: { firstName: true, lastName: true, email: true, role: true, totpEnabled: true, totpSecret: true },
  });

  // A secret without totpEnabled = setup started but not confirmed yet.
  let setup: { qrSvg: string; secret: string; email: string } | null = null;
  if (!user.totpEnabled && user.totpSecret) {
    const secret = openTotpSecret(user.totpSecret);
    const qrSvg = await QRCode.toString(totpUri(user.email, secret), {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
    });
    setup = { qrSvg, secret, email: user.email };
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Section title="Profile">
        <ProfileForm firstName={user.firstName ?? ""} lastName={user.lastName ?? ""} email={user.email} />
      </Section>

      <Section title="Password" description="Use at least 8 characters. We'll email you when it changes.">
        <PasswordForm />
      </Section>

      <Section title="Two-step sign-in" description="Optional extra protection for your account and keys.">
        <TwoFactorSection enabled={user.totpEnabled} isAdmin={user.role === "ADMIN"} setup={setup} />
      </Section>
    </div>
  );
}
