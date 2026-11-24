import { SiteHeader } from "@/components/shop/site-header";
import { SiteFooter } from "@/components/shop/site-footer";
import { MaintenanceBanner } from "@/components/maintenance-banner";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <MaintenanceBanner />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
