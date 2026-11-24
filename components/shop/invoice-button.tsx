import { FileDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Path of an order's PDF invoice; `token` is the private-link token for guests. */
export function invoiceHref(orderNumber: string, token?: string | null): string {
  const qs = token ? `?t=${encodeURIComponent(token)}` : "";
  return `/api/orders/${encodeURIComponent(orderNumber)}/invoice${qs}`;
}

/** "Download invoice" for a paid order (the route checks access again). */
export function InvoiceButton({
  orderNumber,
  token,
  size = "sm",
  variant = "outline",
  className,
  label = "Download invoice",
}: {
  orderNumber: string;
  token?: string | null;
  size?: "sm" | "default" | "xs";
  variant?: "outline" | "ghost" | "default" | "secondary";
  className?: string;
  label?: string;
}) {
  return (
    // A plain link: the response is a file download, not a page.
    <a href={invoiceHref(orderNumber, token)} download className={cn(buttonVariants({ size, variant }), className)}>
      <FileDown />
      {label}
    </a>
  );
}
