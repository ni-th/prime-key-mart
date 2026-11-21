import type { Metadata } from "next";
import Link from "next/link";
import { findValidResetToken } from "@/lib/password-reset";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Reset password",
  // The token is in the URL — never leak it to other sites via Referer.
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = await findValidResetToken(token);

  if (!token || !valid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link expired</CardTitle>
          <CardDescription>
            This password reset link is invalid, has already been used, or has
            expired. Reset links work once, for 30 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/forgot-password" className={cn(buttonVariants(), "w-full")}>
            Request a new link
          </Link>
        </CardContent>
      </Card>
    );
  }

  return <ResetPasswordForm token={token} email={valid.user.email} />;
}
