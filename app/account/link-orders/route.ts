import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { linkGuestOrders, linkTokenUserId, verifyLinkToken } from "@/lib/account-link";

export const runtime = "nodejs";

/**
 * The "Confirm and add my orders" link from the confirm-email message. Opening
 * it proves the account owner can read that inbox, so we mark the email as
 * confirmed and move its guest orders into the account. Safe to open twice.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  const back = (query: string) => NextResponse.redirect(new URL(`/account?${query}`, url));

  const userId = linkTokenUserId(token);
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, suspended: true } })
    : null;
  if (!user || user.suspended || !verifyLinkToken(token, user.email)) return back("link=invalid");

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date() },
  });
  const linked = await linkGuestOrders(user.id, user.email);
  return back(`link=done&n=${linked}`);
}
