import type { Metadata } from "next";
import { SiteHeader } from "@/components/shop/site-header";
import { SiteFooter } from "@/components/shop/site-footer";
import { NotFoundContent } from "@/components/shop/not-found-content";

export const metadata: Metadata = { title: "Page not found" };

/**
 * 404 for any URL that matches no route (e.g. /abc). It sits outside the
 * shop layout, so it adds the header and footer itself: visitors keep the
 * menu, search and cart instead of a dead end.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="flex-1">
        <NotFoundContent />
      </main>
      <SiteFooter />
    </div>
  );
}
