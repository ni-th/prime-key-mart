import type { DefaultSession } from "next-auth";

type UserRole = "USER" | "ADMIN";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      /** This sign-in passed the authenticator-code (2FA) check. */
      mfa: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
    mfa?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    mfa?: boolean;
  }
}
