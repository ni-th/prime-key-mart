"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderTree, LayoutDashboard, Mail, Package, Percent, Receipt, Settings, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/discounts", label: "Discounts", icon: Percent },
  { href: "/admin/orders", label: "Orders", icon: Receipt },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/emails", label: "Emails", icon: Mail },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

/** Dashboard only matches exactly; sections also match their sub-pages. */
function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Admin section navigation with the current section highlighted.
 * `vertical` is the desktop sidebar; `horizontal` is the scrollable tab bar
 * shown on small screens (where the sidebar is hidden).
 */
export function AdminNav({ orientation }: { orientation: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  const vertical = orientation === "vertical";

  return (
    <nav
      aria-label="Admin"
      className={cn(
        "flex gap-1",
        vertical ? "flex-col" : "-mx-4 overflow-x-auto px-4 scrollbar-none",
      )}
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
              active
                ? "bg-primary/10 font-medium text-primary hover:bg-primary/15 hover:text-primary dark:bg-primary/20 dark:text-foreground dark:hover:bg-primary/25 dark:hover:text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
