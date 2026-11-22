import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  ADMIN_PAGE_SIZE,
  getAdminProducts,
  LOW_STOCK_THRESHOLD,
  PRODUCT_SORTS,
  PRODUCT_STATUS_FILTERS,
  PRODUCT_STOCK_FILTERS,
} from "@/lib/admin";
import { getAllCategories } from "@/lib/products";
import { oneOf, pageParam, paginate, param, type RawParams } from "@/lib/list-params";
import { ListClear, ListSearch, ListSelect } from "@/components/admin/list-controls";
import { ListPagination } from "@/components/admin/list-pagination";
import { formatMoney, formatUsd } from "@/lib/money";
import { getPricingSettings, priceOf } from "@/lib/pricing";
import { asCurrency, unitProfit } from "@/lib/profit";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Products · Admin" };

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const sp = await searchParams;
  const q = param(sp, "q");
  const category = param(sp, "category");
  const status = param(sp, "status");
  const stock = param(sp, "stock");
  const sort = oneOf(param(sp, "sort"), PRODUCT_SORTS, "newest");

  const [products, categories, pricing] = await Promise.all([
    getAdminProducts({
      q: q || undefined,
      category: category || undefined,
      status: PRODUCT_STATUS_FILTERS.find((s) => s === status),
      stock: PRODUCT_STOCK_FILTERS.find((s) => s === stock),
      sort,
    }),
    getAllCategories(),
    getPricingSettings(),
  ]);
  const filtered = Boolean(q || category || status || stock);
  const { page, items, total } = paginate(products, pageParam(sp), ADMIN_PAGE_SIZE);
  const pagination = (
    <ListPagination
      path="/admin/products"
      params={sp}
      page={page}
      pageSize={ADMIN_PAGE_SIZE}
      total={total}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <Link
          href="/admin/products/new"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          <Plus className="size-4" />
          New product
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ListSearch placeholder="Search name, brand, platform..." />
        <ListSelect
          param="category"
          label="Category"
          options={[
            { value: "", label: "All categories" },
            ...categories.map((c) => ({ value: c.slug, label: c.name })),
          ]}
        />
        <ListSelect
          param="status"
          label="Status"
          className="w-36"
          options={[
            { value: "", label: "Any status" },
            { value: "published", label: "Published" },
            { value: "hidden", label: "Hidden" },
            { value: "featured", label: "Featured" },
          ]}
        />
        <ListSelect
          param="stock"
          label="Stock"
          className="w-36"
          options={[
            { value: "", label: "Any stock" },
            { value: "in", label: "In stock" },
            { value: "low", label: `Low (< ${LOW_STOCK_THRESHOLD})` },
            { value: "out", label: "Out of stock" },
          ]}
        />
        <ListSelect
          param="sort"
          label="Sort"
          className="w-44"
          options={[
            { value: "", label: "Newest first" },
            { value: "name", label: "Name A-Z" },
            { value: "price-asc", label: "Price: low to high" },
            { value: "price-desc", label: "Price: high to low" },
            { value: "stock-asc", label: "Lowest stock" },
            { value: "best-selling", label: "Best selling" },
          ]}
        />
        <ListClear keys={["q", "category", "status", "stock", "sort"]} />
      </div>

      {pagination}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Profit / sale</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Sold</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {total === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {filtered ? "No products match these filters." : "No products yet."}
                </TableCell>
              </TableRow>
            )}
            {items.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="font-medium hover:underline"
                  >
                    {p.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{p.brand}</div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.category.name}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatUsd(p.priceCents)}
                  <div className="text-xs text-muted-foreground">
                    {formatMoney(priceOf(p, pricing).lkrCents, "LKR")}
                    {p.priceLkrCents !== null && (
                      <span className="ml-1 font-medium text-primary">fixed</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.costCents === null ? (
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Set cost
                    </Link>
                  ) : (
                    (["USD", "LKR"] as const).map((currency, i) => {
                      const price = priceOf(p, pricing);
                      const profit = unitProfit({
                        priceCents: currency === "USD" ? price.usdCents : price.lkrCents,
                        currency,
                        costCents: p.costCents!,
                        costCurrency: asCurrency(p.costCurrency),
                        feePercent: pricing.gatewayFeePercent,
                        rate: pricing.rate,
                      });
                      return (
                        <div
                          key={currency}
                          className={cn(
                            i > 0 && "text-xs",
                            profit.profitCents < 0
                              ? "text-destructive"
                              : i === 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground",
                          )}
                        >
                          {formatMoney(profit.profitCents, currency)}
                        </div>
                      );
                    })
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    p.stock === 0
                      ? "text-destructive"
                      : p.stock < LOW_STOCK_THRESHOLD
                        ? "text-amber-600 dark:text-amber-400"
                        : "",
                  )}
                >
                  <Link
                    href={`/admin/products/${p.id}/keys`}
                    className="hover:underline"
                  >
                    {p.stock}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {p.sold}
                </TableCell>
                <TableCell>
                  {p.published ? (
                    <Badge variant="secondary">Published</Badge>
                  ) : (
                    <Badge variant="outline">Hidden</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {total > ADMIN_PAGE_SIZE && pagination}
    </div>
  );
}
