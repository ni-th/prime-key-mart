"use client";

import Link from "next/link";
import { PackageX } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCart } from "@/lib/cart-store";
import { issueLabel, type CartIssue } from "@/lib/cart-issues";
import { cn } from "@/lib/utils";

/**
 * Shown when the customer tries to pay but some items can't be bought as they
 * are (sold out, fewer keys left than wanted, or no longer sold). "Update my
 * cart" removes sold-out items and lowers quantities to what's in stock.
 */
export function StockIssueDialog({
  issues,
  open,
  onOpenChange,
  onCartPage = false,
}: {
  issues: CartIssue[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Already on /cart: offer "Not now" (close) instead of "Back to cart". */
  onCartPage?: boolean;
}) {
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const allGone = issues.length > 0 && issues.every((i) => i.kind !== "short");

  function fixCart() {
    for (const issue of issues) {
      if (issue.kind === "short") setQty(issue.productId, issue.stock);
      else remove(issue.productId);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageX className="size-5 text-destructive" />
            {issues.length === 1 ? "An item in your cart" : "Some items in your cart"}{" "}
            {allGone ? "sold out" : "changed"}
          </DialogTitle>
          <DialogDescription>
            Keys sell fast, and these changed since you added them. Update your cart to continue
            with the rest; you haven&apos;t been charged.
          </DialogDescription>
        </DialogHeader>

        <ul className="divide-y rounded-lg border text-sm">
          {issues.map((i) => (
            <li key={i.productId} className="flex items-center justify-between gap-3 p-3">
              <span className="min-w-0">
                <span className="block truncate font-medium">{i.name}</span>
                <span className="text-xs text-muted-foreground">
                  {i.kind === "short"
                    ? `You wanted ${i.quantity}; we'll change it to ${i.stock}.`
                    : "We'll remove it from your cart."}
                </span>
              </span>
              <span className="shrink-0 text-xs font-medium text-destructive">{issueLabel(i)}</span>
            </li>
          ))}
        </ul>

        <DialogFooter>
          {onCartPage ? (
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Not now
            </Button>
          ) : (
            <Link
              href="/cart"
              className={cn(buttonVariants({ variant: "ghost" }))}
              onClick={() => onOpenChange(false)}
            >
              Back to cart
            </Link>
          )}
          <Button type="button" onClick={fixCart}>
            Update my cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
