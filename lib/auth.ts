import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import { openTotpSecret, verifyTotp } from "@/lib/totp";

/** Password was right; this admin must now enter their authenticator code. */
class TotpRequired extends CredentialsSignin {
  code = "totp_required";
}
/** Password was right but the authenticator code was wrong or already used. */
class TotpInvalid extends CredentialsSignin {
  code = "totp_invalid";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        code: { label: "Authenticator code", type: "text" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password, code } = parsed.data;
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user?.passwordHash) return null;
        if (user.suspended) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // Second factor for admins who have set up an authenticator app.
        // (Admins who haven't are signed in without `mfa` and are forced
        // through /two-factor setup before they can reach /admin.)
        let mfa = false;
        if (user.role === "ADMIN" && user.totpEnabled && user.totpSecret) {
          if (!code) throw new TotpRequired();

          const step = verifyTotp(
            openTotpSecret(user.totpSecret),
            code,
            user.totpLastStep,
          );
          if (step === null) throw new TotpInvalid();

          // Record the step atomically so the same code can't be used twice,
          // even by two simultaneous requests.
          const { count } = await prisma.user.updateMany({
            where: {
              id: user.id,
              OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }],
            },
            data: { totpLastStep: step },
          });
          if (count === 0) throw new TotpInvalid();
          mfa = true;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mfa,
        };
      },
    }),
  ],
});
