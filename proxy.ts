import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { getMaintenance, isOpenDuringMaintenance } from "@/lib/maintenance";

const { auth } = NextAuth(authConfig);

/** Tells browsers and search engines it's temporary (10 minutes). */
const RETRY_AFTER = { "Retry-After": "600" };

export default auth(async (req) => {
  const { pathname, search } = req.nextUrl;
  const session = req.auth;
  const role = session?.user?.role;

  const needsAuth =
    pathname.startsWith("/account") || pathname.startsWith("/admin");

  if (needsAuth && !session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Admins must have passed the authenticator-code check in this session.
  if (pathname.startsWith("/admin") && !session?.user?.mfa) {
    return NextResponse.redirect(new URL("/two-factor", req.url));
  }

  // Maintenance mode (Admin -> Settings): customers see the maintenance page;
  // admins can still browse the shop to check it before reopening.
  if (role !== "ADMIN" && !isOpenDuringMaintenance(pathname)) {
    const maintenance = await getMaintenance();
    if (maintenance.on) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "The store is closed for maintenance. Please try again soon." },
          { status: 503, headers: RETRY_AFTER },
        );
      }
      return NextResponse.rewrite(new URL("/maintenance", req.url), {
        status: 503,
        headers: RETRY_AFTER,
      });
    }
  }

  return NextResponse.next();
});

export const config = {
  // Everything except build assets and static files (images, icons,
  // robots.txt, sitemap.xml...), which stay available during maintenance.
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
