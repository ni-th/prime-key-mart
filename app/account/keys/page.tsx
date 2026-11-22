import type { Metadata } from "next";
import { Search } from "lucide-react";
import { auth } from "@/lib/auth";
import { keysForUser } from "@/lib/warranty-claims";
import { OrderKeys } from "@/components/shop/order-keys";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "My keys" };

export default async function AccountKeysPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const session = await auth();
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").trim().slice(0, 80);

  const all = await keysForUser(session!.user.id);
  const items = q ? all.filter((i) => i.productName.toLowerCase().includes(q.toLowerCase())) : all;
  const keyCount = all.reduce((n, i) => n + i.keys.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My keys</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {keyCount === 0
            ? "Keys from your delivered orders appear here."
            : `All ${keyCount} key${keyCount === 1 ? "" : "s"} from your orders. Keys stay hidden until you tap the eye.`}
        </p>
      </div>

      {all.length > 3 && (
        <form className="flex gap-2" role="search">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="Search by product" className="pl-8" aria-label="Search keys by product" />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      )}

      <OrderKeys
        token={null}
        items={items}
        showOrder
        emptyText={q ? `No keys match "${q}".` : "You don't have any keys yet."}
      />
    </div>
  );
}
