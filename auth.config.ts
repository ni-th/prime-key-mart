import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config. Contains no database or bcrypt access so it can be
 * imported by middleware. The Credentials provider (with `authorize`) is added
 * in `lib/auth.ts`, which only runs in the Node.js runtime.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      // Name changed in account settings (unstable_update from the server).
      if (trigger === "update") {
        const name = (session as { user?: { name?: unknown } } | undefined)?.user?.name;
        if (typeof name === "string" && name.trim()) token.name = name.trim().slice(0, 80);
        return token;
      }
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: "USER" | "ADMIN" }).role ?? "USER";
        // True only when this sign-in passed the authenticator-code check.
        token.mfa = (user as { mfa?: boolean }).mfa === true;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? token.sub ?? "";
        session.user.role = (token.role as "USER" | "ADMIN") ?? "USER";
        session.user.mfa = token.mfa === true;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
