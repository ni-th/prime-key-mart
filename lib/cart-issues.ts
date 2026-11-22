import type { CartQuoteLine } from "@/app/actions/pricing";
import type { CartLine } from "@/lib/cart-store";

/** A cart line that can't be bought as it is. Client-safe. */
export type CartIssue = {
  productId: string;
  name: string;
  quantity: number;
  /** removed = unpublished/deleted, out = no keys, short = fewer keys than wanted. */
  kind: "removed" | "out" | "short";
  /** Keys available (for "short"). */
  stock: number;
};

/** Problems in the cart according to the latest server quote. */
export function cartIssues(lines: CartLine[], quoted: Map<string, CartQuoteLine>): CartIssue[] {
  const issues: CartIssue[] = [];
  for (const line of lines) {
    const q = quoted.get(line.productId);
    if (!q) continue; // not quoted yet
    const base = { productId: line.productId, name: line.name, quantity: line.quantity, stock: q.stock };
    if (!q.available) issues.push({ ...base, kind: "removed" });
    else if (q.stock === 0) issues.push({ ...base, kind: "out" });
    else if (q.stock < line.quantity) issues.push({ ...base, kind: "short" });
  }
  return issues;
}

export function issueLabel(issue: CartIssue): string {
  if (issue.kind === "removed") return "No longer available";
  if (issue.kind === "out") return "Out of stock";
  return `Only ${issue.stock} left`;
}
