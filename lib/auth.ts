import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import { openTotpSecret, verifyTotp } from "@/lib/totp";
import { countHits, recordHits } from "@/lib/rate-limit";
import { verifySignupTicket, verifyTurnstile } from "@/lib/turnstile";

/** Failed sign-ins allowed per window before that email / IP must wait. */
const LOGIN_WINDOW_SECONDS = 15 * 60;
const MAX_FAILS_PER_EMAIL = 8;
const MAX_FAILS_PER_IP = 30;

/** Password was right; this admin must now enter their authenticator code. */
class TotpRequired extends CredentialsSignin {
  code = "totp_required";
}
/** Password was right but the authenticator code was wrong or already used. */
class TotpInvalid extends CredentialsSignin {
  code = "totp_invalid";
}
/** Too many failed attempts for this email or network. */
class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited";
}
/** The "are you human" check failed or was missing. */
class CaptchaFailed extends CredentialsSignin {
  code = "captcha";
}

function requestIp(request: Request | undefined): string {
  const h = request?.headers;
  return h?.get("x-forwarded-for")?.split(",")[0]?.trim() || h?.get("x-real-ip")?.trim() || "unknown";
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        code: { label: "Authenticator code", type: "text" },
        turnstile: { label: "Bot check", type: "text" },
        ticket: { label: "Sign-up ticket", type: "text" },
      },
      async authorize(raw, request) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { password, code, turnstile, ticket } = parsed.data;
        const email = parsed.data.email.toLowerCase();
        const ip = requestIp(request);
        const failKeys = [`login-fail-email:${email}`, `login-fail-ip:${ip}`];

        // Lock out password guessing: per account and per network.
        const [emailFails, ipFails] = await Promise.all([
          countHits(failKeys[0], LOGIN_WINDOW_SECONDS),
          countHits(failKeys[1], LOGIN_WINDOW_SECONDS),
        ]);
        if (emailFails >= MAX_FAILS_PER_EMAIL || ipFails >= MAX_FAILS_PER_IP) throw new TooManyAttempts();

        // Every attempt (including the code step) needs a fresh human check,
        // except the automatic sign-in straight after sign-up.
        if (!verifySignupTicket(ticket, email) && !(await verifyTurnstile(turnstile, ip))) {
          throw new CaptchaFailed();
        }

        const user = await prisma.user.findUnique({ where: { email } });
        const ok = !!user?.passwordHash && (await bcrypt.compare(password, user.passwordHash));
        if (!user || !ok || user.suspended) {
          await recordHits(failKeys);
          return null;
        }

        // Second factor for anyone who has turned on an authenticator app
        // (required for admins; optional for customers in account settings).
        // Admins without it are signed in without `mfa` and are forced
        // through /two-factor setup before they can reach /admin.
        let mfa = false;
        if (user.totpEnabled && user.totpSecret) {
          if (!code) throw new TotpRequired();

          const step = verifyTotp(
            openTotpSecret(user.totpSecret),
            code,
            user.totpLastStep,
          );
          if (step === null) {
            await recordHits(failKeys);
            throw new TotpInvalid();
          }

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
