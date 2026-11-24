import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { StatusPage } from "@/components/status-page";
import { cn } from "@/lib/utils";

/** notFound() inside admin (a deleted product, order or user): keeps the admin nav. */
export default function AdminNotFound() {
  return (
    <StatusPage code="404" icon={<SearchX className="size-6" />} title="Not found" className="py-12 sm:py-16">
      <p className="mx-auto max-w-sm">
        This item doesn&apos;t exist. It may have been deleted, or the link is wrong.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/admin" className={cn(buttonVariants({ size: "sm" }))}>
          Admin dashboard
        </Link>
        <Link href="/admin/orders" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Orders
        </Link>
        <Link href="/admin/products" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Products
        </Link>
      </div>
    </StatusPage>
  );
}
