"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { saveDiscount } from "@/app/actions/discounts";
import type { FormResult } from "@/app/actions/admin";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/money";
import { asCurrency, unitProfit } from "@/lib/profit";
import {
  DISCOUNT_MAX_PERCENT,
  DISCOUNT_MIN_PERCENT,
  discountApplies,
  discountedLkrCents,
  discountedUsdCents,
  type DiscountScope,
} from "@/lib/sale";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

export type DiscountFormValues = {
  id: string;
  name: string;
  percent: number;
  scope: DiscountScope;
  categoryIds: string[];
  productIds: string[];
  active: boolean;
  /** ISO strings (converted to the admin's local time in the browser). */
  startsAt: string | null;
  endsAt: string | null;
};

export type DiscountFormProduct = {
  id: string;
  name: string;
  brand: string;
  categoryId: string;
  priceCents: number;
  priceLkrCents: number | null;
  costCents: number | null;
  costCurrency: string;
};

type Pricing = { rate: number; marginPercent: number; gatewayFeePercent: number };

const SCOPES: { value: DiscountScope; label: string; hint: string }[] = [
  { value: "ALL", label: "Every product", hint: "A store-wide sale." },
  { value: "CATEGORIES", label: "Categories", hint: "Everything in the chosen categories." },
  { value: "PRODUCTS", label: "Chosen products", hint: "Only the products you tick." },
];

const pad = (n: number) => String(n).padStart(2, "0");

/** Every 30 minutes, plus 23:59 so a sale can run to the end of a day. */
const TIME_SLOTS = [
  ...Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`),
  "23:59",
];

/** "13:30" -> "1:30 PM" */
function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
}

/** Local "HH:mm" of an ISO time (browser time zone). */
function localTime(iso: string | null, fallback: string): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local midnight of an ISO time's day (browser time zone). */
function localDay(iso: string | null): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** A day + "HH:mm" in the browser time zone -> ISO ("" when no day). */
function combine(day: Date | undefined, hhmm: string): string {
  if (!day) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).toISOString();
}

function TimeSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  // Keep an existing odd time (e.g. 12:27) selectable.
  const slots = TIME_SLOTS.includes(value) ? TIME_SLOTS : [...TIME_SLOTS, value].sort();
  const items = slots.map((t) => ({ value: t, label: timeLabel(t) }));
  return (
    <Select
      value={value}
      items={items}
      disabled={disabled}
      onValueChange={(v) => v && onChange(v as string)}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {items.map((t) => (
          <SelectItem key={t.value} value={t.value}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Hint({ error, children }: { error?: string; children?: React.ReactNode }) {
  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (!children) return null;
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {isEdit ? "Save changes" : "Create sale"}
    </Button>
  );
}

export function DiscountForm({
  discount,
  categories,
  products,
  pricing,
}: {
  discount?: DiscountFormValues;
  categories: { id: string; name: string }[];
  /** Admin only: includes cost prices for the below-cost check. */
  products: DiscountFormProduct[];
  pricing: Pricing;
}) {
  const [state, formAction] = useActionState<FormResult, FormData>(saveDiscount, {
    ok: false,
    error: "",
  });
  const fe = (!state.ok && state.fieldErrors) || {};
  const hydrated = useHydrated();

  const [percentInput, setPercentInput] = useState(discount ? String(discount.percent) : "");
  const [scope, setScope] = useState<DiscountScope>(discount?.scope ?? "ALL");
  const [categoryIds, setCategoryIds] = useState<string[]>(discount?.categoryIds ?? []);
  const [productIds, setProductIds] = useState<string[]>(discount?.productIds ?? []);
  const [productQuery, setProductQuery] = useState("");
  // Dates/times live in the admin's time zone in the browser and are sent as
  // ISO (UTC) strings, so the server's time zone never matters.
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const from = localDay(discount?.startsAt ?? null);
    const to = localDay(discount?.endsAt ?? null);
    return from || to ? { from: from ?? to, to } : undefined;
  });
  const [startTime, setStartTime] = useState(() => localTime(discount?.startsAt ?? null, "00:00"));
  const [endTime, setEndTime] = useState(() => localTime(discount?.endsAt ?? null, "23:59"));
  // A start date only = runs from then with no end; no dates = starts now.
  const startsIso = combine(range?.from, startTime);
  const endsIso = combine(range?.to, endTime);

  const percent = Number.parseFloat(percentInput);
  const percentValid =
    Number.isFinite(percent) && percent >= DISCOUNT_MIN_PERCENT && percent <= DISCOUNT_MAX_PERCENT;

  const covered = useMemo(
    () => products.filter((p) => discountApplies({ scope, categoryIds, productIds }, p)),
    [products, scope, categoryIds, productIds],
  );

  // Products that would lose money at this percent (after gateway fees), in
  // either currency. LKR list price uses the same rounding as lib/pricing.ts.
  const belowCost = useMemo(() => {
    if (!percentValid) return [];
    const effective = pricing.rate * (1 + pricing.marginPercent / 100);
    return covered.filter((p) => {
      if (p.costCents === null) return false;
      const listLkr = p.priceLkrCents ?? Math.round((p.priceCents / 100) * effective) * 100;
      const common = {
        costCents: p.costCents,
        costCurrency: asCurrency(p.costCurrency),
        feePercent: pricing.gatewayFeePercent,
        rate: pricing.rate,
      };
      const usd = unitProfit({ ...common, priceCents: discountedUsdCents(p.priceCents, percent), currency: "USD" });
      const lkr = unitProfit({ ...common, priceCents: discountedLkrCents(listLkr, percent), currency: "LKR" });
      return usd.profitCents < 0 || lkr.profitCents < 0;
    });
  }, [covered, percent, percentValid, pricing]);
  const missingCost = covered.filter((p) => p.costCents === null).length;

  const shownProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q),
    );
  }, [products, productQuery]);

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const example = products[0];

  return (
    <form action={formAction} className="space-y-6">
      {discount && <input type="hidden" name="id" value={discount.id} />}
      <input type="hidden" name="scope" value={scope} />
      {scope === "CATEGORIES" &&
        categoryIds.map((id) => <input key={id} type="hidden" name="categoryIds" value={id} />)}
      {scope === "PRODUCTS" &&
        productIds.map((id) => <input key={id} type="hidden" name="productIds" value={id} />)}
      {hydrated && (
        <>
          <input type="hidden" name="startsAt" value={startsIso} />
          <input type="hidden" name="endsAt" value={endsIso} />
        </>
      )}

      {!state.ok && state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Sale name</Label>
          <Input
            id="name"
            name="name"
            defaultValue={discount?.name}
            placeholder="e.g. Black Friday"
            required
            maxLength={60}
            aria-invalid={fe.name ? true : undefined}
          />
          <Hint error={fe.name}>Shown to customers next to the sale price.</Hint>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="percent">Percent off</Label>
          <Input
            id="percent"
            name="percent"
            type="number"
            inputMode="decimal"
            min={DISCOUNT_MIN_PERCENT}
            max={DISCOUNT_MAX_PERCENT}
            step="0.1"
            required
            value={percentInput}
            onChange={(e) => setPercentInput(e.target.value)}
            placeholder="20"
            aria-invalid={fe.percent ? true : undefined}
          />
          <Hint error={fe.percent}>
            {percentValid && example
              ? `e.g. ${example.name}: ${formatMoney(example.priceCents, "USD")} becomes ${formatMoney(discountedUsdCents(example.priceCents, percent), "USD")}.`
              : "Applies to USD and LKR prices alike (LKR rounded to whole rupees)."}
          </Hint>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-medium">Applies to</h2>
          <p className="text-sm text-muted-foreground">
            If a product is in more than one live sale, the customer gets the biggest discount.
            Sales never stack.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Applies to">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={scope === s.value}
              onClick={() => setScope(s.value)}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition-colors",
                scope === s.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "hover:bg-muted/50",
              )}
            >
              <div className="font-medium">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.hint}</div>
            </button>
          ))}
        </div>

        {scope === "CATEGORIES" && (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={categoryIds.includes(c.id)}
                    onChange={() => setCategoryIds((l) => toggle(l, c.id))}
                    className="size-4 rounded border-input"
                  />
                  {c.name}
                </label>
              ))}
            </div>
            <Hint error={fe.categoryIds} />
          </div>
        )}

        {scope === "PRODUCTS" && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Search products"
                className="pl-8"
                aria-label="Search products"
              />
            </div>
            <div className="max-h-72 divide-y overflow-y-auto rounded-lg border">
              {shownProducts.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">No products match.</p>
              )}
              {shownProducts.map((p) => (
                <label key={p.id} className="flex items-center gap-2 p-2.5 text-sm hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={productIds.includes(p.id)}
                    onChange={() => setProductIds((l) => toggle(l, p.id))}
                    className="size-4 rounded border-input"
                  />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatMoney(p.priceCents, "USD")}
                  </span>
                </label>
              ))}
            </div>
            <Hint error={fe.productIds}>{productIds.length} selected</Hint>
          </div>
        )}

        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <div>
            Covers <span className="font-medium">{covered.length}</span> of {products.length}{" "}
            products.
          </div>
          {belowCost.length > 0 && (
            <div className="mt-2 flex gap-2 text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <div className="font-medium">
                  {belowCost.length} product{belowCost.length === 1 ? "" : "s"} would sell below
                  cost at {percent}% off (after gateway fees):
                </div>
                <div className="text-xs">
                  {belowCost.slice(0, 5).map((p) => p.name).join(", ")}
                  {belowCost.length > 5 ? ` and ${belowCost.length - 5} more` : ""}
                </div>
              </div>
            </div>
          )}
          {missingCost > 0 && (
            <div className="mt-1 text-xs text-muted-foreground">
              {missingCost} covered product{missingCost === 1 ? " has" : "s have"} no cost price, so
              they can&apos;t be checked for losses.
            </div>
          )}
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-medium">Schedule</h2>
          <p className="text-sm text-muted-foreground">
            Optional. Leave empty to start now and run until you turn it off. Times are in your
            time zone.
          </p>
        </div>
        {hydrated ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="saleDates">Dates</Label>
              <DateRangePicker
                id="saleDates"
                className="w-full sm:w-80"
                placeholder="Starts now, no end date"
                value={range}
                onChange={setRange}
                invalid={Boolean(fe.startsAt || fe.endsAt)}
              />
              <Hint error={fe.startsAt ?? fe.endsAt}>
                {!range?.from
                  ? "No dates: the sale starts as soon as you save and runs until you pause it."
                  : !range.to
                    ? "Start date only: runs from then with no end date. Pick a second day to set an end."
                    : "Customers see a countdown such as \"Ends in 2 days\"."}
              </Hint>
            </div>
            {range?.from && (
              <div className="grid gap-4 sm:max-w-80 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="startTime">Start time</Label>
                  <TimeSelect id="startTime" value={startTime} onChange={setStartTime} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endTime">End time</Label>
                  <TimeSelect
                    id="endTime"
                    value={endTime}
                    onChange={setEndTime}
                    disabled={!range.to}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <Skeleton className="h-16 w-full" />
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={discount?.active ?? true}
            className="size-4 rounded border-input"
          />
          Active (untick to pause the sale straight away)
        </label>
      </Card>

      <div className="flex gap-3">
        <SubmitButton isEdit={Boolean(discount)} />
        <Link href="/admin/discounts" className={cn(buttonVariants({ variant: "ghost" }))}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
