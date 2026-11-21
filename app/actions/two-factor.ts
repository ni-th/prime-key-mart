"use server";

import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { openTotpSecret, verifyTotp } from "@/lib/totp";

export type TwoFactorState = { error: string | null };

/**
 * Confirm authenticator setup: the admin types the code their app shows for
 * the secret we stored on /two-factor. On success 2FA is switched on and they
 * are signed out, so the next sign-in goes through the code check and gets a
 * session marked `mfa`.
 */
export async function confirmTwoFactor(
  _prev: TwoFactorState,
  formData: FormData,
): Promise<TwoFactorState> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { error: "Not authorized." };

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.totpSecret) return { error: "Setup expired - reload the page." };
  if (user.totpEnabled) return { error: "Two-factor is already on. Sign in again." };

  const code = String(formData.get("code") ?? "");
  const step = verifyTotp(openTotpSecret(user.totpSecret), code);
  if (step === null) {
    return {
      error:
        "That code didn't match. Check the time on your phone is set automatically and try the newest code.",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true, totpLastStep: step },
  });

  await signOut({ redirectTo: "/login?callbackUrl=/admin&twofa=enabled" });
  return { error: null };
}

/** Sign out so an admin whose session predates 2FA can sign in with a code. */
export async function signOutForTwoFactor(): Promise<void> {
  await signOut({ redirectTo: "/login?callbackUrl=/admin" });
}
