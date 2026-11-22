"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { KeyRound, LayoutDashboard, LogOut, Receipt, Settings } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/account", label: "Overview", icon: LayoutDashboard },
  { href: "/account/orders", label: "Orders", icon: Receipt },
  { href: "/account/keys", label: "My keys", icon: KeyRound },
  { href: "/account/settings", label: "Settings", icon: Settings },
];

/** Overview only matches exactly; sections also match their sub-pages. */
function isActive(pathname: string, href: string) {
  if (href === "/account") return pathname === "/account";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const ACTIVE =
  "bg-primary/10 font-medium text-primary hover:bg-primary/15 hover:text-primary dark:bg-primary/20 dark:text-foreground dark:hover:bg-primary/25 dark:hover:text-foreground";

/**
 * Account section navigation, styled like the admin panel's.
 * `vertical` is the desktop sidebar (with sign out); `horizontal` is the
 * scrollable tab bar on small screens.
 */
export function AccountNav({ orientation }: { orientation: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  const router = useRouter();
  const vertical = orientation === "vertical";

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  }

  return (
    <nav
      aria-label="Account"
      className={cn("flex gap-1", vertical ? "flex-col" : "-mx-4 overflow-x-auto px-4 scrollbar-none")}
    >
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "shrink-0",
              vertical && "justify-start",
              active ? ACTIVE : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
      {vertical && (
        <div className="mt-3 border-t pt-3">
          <button
            type="button"
            onClick={handleSignOut}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "w-full justify-start text-muted-foreground hover:text-destructive",
            )}
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}
