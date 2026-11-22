"use client";

import Link from "next/link";
import { ImageUpload } from "@/components/admin/image-upload";
import { useActionState, useState } from "react";
import { formatMoney } from "@/lib/money";
import { unitProfit, type Currency } from "@/lib/profit";

/** Matches LKR_DRIFT_WARN_PERCENT in lib/pricing.ts (not imported: server-only module). */
const LKR_DRIFT_WARN_PERCENT = 10;
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { saveProduct, type FormResult } from "@/app/actions/admin";

type Category = { id: string; name: string };

export type ProductFormValues = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  brand: string;
  platform: string;
  region: string;
  priceCents: number;
  priceLkrCents: number | null;
  /** Admin only: purchase cost per key. */
  costCents: number | null;
  costCurrency: Currency;
  /** Low stock alert level for this product; null = store default. */
  lowStockThreshold: number | null;
  categoryId: string;
  imageUrl: string | null;
  published: boolean;
  featured: boolean;
};

function Field({
  label,
  htmlFor,
  error,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {isEdit ? "Save changes" : "Create product"}
    </Button>
  );
}

type Pricing = { rate: number; marginPercent: number; gatewayFeePercent: number };

/** Profit breakdown for one sale in `currency`. */
function ProfitColumn({
  label,
  currency,
  priceCents,
  costCents,
  costCurrency,
  pricing,
}: {
  label: string;
  currency: Currency;
  priceCents: number;
  costCents: number;
  costCurrency: Currency;
  pricing: Pricing;
}) {
  const p = unitProfit({
    priceCents,
    currency,
    costCents,
    costCurrency,
    feePercent: pricing.gatewayFeePercent,
    rate: pricing.rate,
  });
  const loss = p.profitCents < 0;
  return (
    <div className="space-y-1 tabular-nums">
      <div className="font-medium">{label}</div>
      <div className="flex justify-between gap-3 text-muted-foreground">
        <span>Customer pays</span>
        <span>{formatMoney(p.priceCents, currency)}</span>
      </div>
      <div className="flex justify-between gap-3 text-muted-foreground">
        <span>Gateway fee ({pricing.gatewayFeePercent}%)</span>
        <span>-{formatMoney(p.feeCents, currency)}</span>
      </div>
      <div className="flex justify-between gap-3 text-muted-foreground">
        <span>Your cost</span>
        <span>-{formatMoney(p.costCents, currency)}</span>
      </div>
      <div
        className={cn(
          "flex justify-between gap-3 border-t pt-1 font-medium",
          loss ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
        )}
      >
        <span>{loss ? "Loss" : "Profit"}</span>
        <span>
          {formatMoney(p.profitCents, currency)}
          {p.marginPercent !== null && (
            <span className="ml-1 text-xs font-normal">({p.marginPercent.toFixed(1)}%)</span>
          )}
        </span>
      </div>
    </div>
  );
}

/**
 * USD price + optional fixed LKR price (calculated LKR shown live), plus the
 * admin-only purchase cost and the resulting profit per sale.
 */
function PriceFields({
  priceCents,
  priceLkrCents,
  costCents,
  costCurrency: initialCostCurrency,
  pricing,
  usdError,
  lkrError,
  costError,
}: {
  priceCents?: number;
  priceLkrCents: number | null;
  costCents: number | null;
  costCurrency: Currency;
  pricing: Pricing;
  usdError?: string;
  lkrError?: string;
  costError?: string;
}) {
  const [usd, setUsd] = useState(priceCents !== undefined ? (priceCents / 100).toFixed(2) : "");
  const [lkr, setLkr] = useState(priceLkrCents !== null ? String(priceLkrCents / 100) : "");
  const [cost, setCost] = useState(costCents !== null ? (costCents / 100).toFixed(2) : "");
  const [costCurrency, setCostCurrency] = useState<Currency>(initialCostCurrency);
  const costNum = Number.parseFloat(cost);
  const costValid = cost.trim() !== "" && Number.isFinite(costNum) && costNum >= 0;

  const usdNum = Number.parseFloat(usd);
  const effective = pricing.rate * (1 + pricing.marginPercent / 100);
  // Same rounding as lib/pricing.ts (whole rupees).
  const calculated = Number.isFinite(usdNum) && usdNum >= 0 ? Math.round(usdNum * effective) : null;
  const lkrNum = Number.parseFloat(lkr);
  const fixed = lkr.trim() !== "" && Number.isFinite(lkrNum) ? lkrNum : null;
  const drift =
    fixed !== null && calculated ? Math.round(((fixed - calculated) / calculated) * 100) : null;

  return (
    <>
      <Field label="Price (USD)" htmlFor="price" error={usdError}>
        <Input
          id="price"
          name="price"
          type="number"
          step="0.01"
          min="0"
          value={usd}
          onChange={(e) => setUsd(e.target.value)}
          required
        />
      </Field>
      <div className="space-y-1.5">
        <Label htmlFor="priceLkr">Fixed price in LKR (optional)</Label>
        <Input
          id="priceLkr"
          name="priceLkr"
          type="number"
          step="1"
          min="0"
          placeholder={calculated !== null ? String(calculated) : "Calculated from USD"}
          value={lkr}
          onChange={(e) => setLkr(e.target.value)}
          aria-invalid={lkrError ? true : undefined}
        />
        {lkrError ? (
          <p className="text-xs text-destructive">{lkrError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {calculated !== null ? (
              <>
                At today&apos;s rate: {formatMoney(calculated * 100, "LKR")}.{" "}
                {fixed === null
                  ? "Leave empty to use that."
                  : "Clear the field to use it instead."}
              </>
            ) : (
              "Leave empty to calculate it from the USD price."
            )}
          </p>
        )}
        {drift !== null && Math.abs(drift) >= LKR_DRIFT_WARN_PERCENT && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            This is {Math.abs(drift)}% {drift > 0 ? "above" : "below"} the USD price at
            today&apos;s rate, so customers paying in {drift > 0 ? "USD" : "LKR"} get a
            better deal.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cost">Your cost per key (private)</Label>
        <div className="flex gap-2">
          <Input
            id="cost"
            name="cost"
            type="number"
            step="0.01"
            min="0"
            placeholder="What you paid"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            aria-invalid={costError ? true : undefined}
          />
          <input type="hidden" name="costCurrency" value={costCurrency} />
          <div className="flex shrink-0 rounded-lg border p-0.5" role="group" aria-label="Cost currency">
            {(["USD", "LKR"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCostCurrency(c)}
                aria-pressed={costCurrency === c}
                className={cn(
                  "rounded-md px-2.5 text-xs font-medium transition-colors",
                  costCurrency === c
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <p className={costError ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {costError ?? "Only admins see this. Used to show your real profit after gateway fees."}
        </p>
      </div>

      <div className="rounded-lg border bg-muted/40 p-4 text-sm sm:col-span-2">
        {costValid && calculated !== null ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <ProfitColumn
              label="When paid in USD"
              currency="USD"
              priceCents={Math.round(usdNum * 100)}
              costCents={Math.round(costNum * 100)}
              costCurrency={costCurrency}
              pricing={pricing}
            />
            <ProfitColumn
              label="When paid in LKR"
              currency="LKR"
              priceCents={Math.round(fixed ?? calculated) * 100}
              costCents={Math.round(costNum * 100)}
              costCurrency={costCurrency}
              pricing={pricing}
            />
          </div>
        ) : (
          <p className="text-muted-foreground">
            Enter the price and your cost to see the profit per sale.
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {pricing.gatewayFeePercent === 0
            ? "No gateway fee is set yet - add it in Settings for accurate profit. "
            : ""}
          Costs are converted at the market rate ({pricing.rate} LKR per USD).
        </p>
      </div>
    </>
  );
}

export function ProductForm({
  categories,
  product,
  uploadsEnabled = false,
  pricing,
  defaultLowStock,
}: {
  categories: Category[];
  product?: ProductFormValues;
  /** Cloudinary configured: show the image uploader instead of a URL box. */
  uploadsEnabled?: boolean;
  /** Current exchange rate, margin and gateway fee, for the price/profit previews. */
  pricing: Pricing;
  /** Store-wide low stock level (Admin -> Settings), shown as the placeholder. */
  defaultLowStock: number;
}) {
  const initial: FormResult = { ok: false, error: "" };
  const [state, formAction] = useActionState(saveProduct, initial);
  const fe = (!state.ok && state.fieldErrors) || {};
  const isEdit = Boolean(product?.id);

  return (
    <form action={formAction} className="space-y-6">
      {product?.id && <input type="hidden" name="id" value={product.id} />}

      {!state.ok && state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Card className="space-y-4 p-5">
        <Field label="Name" htmlFor="name" error={fe.name}>
          <Input id="name" name="name" defaultValue={product?.name} required />
        </Field>
        <Field
          label="Slug"
          htmlFor="slug"
          error={fe.slug}
          hint="URL identifier. Leave blank to generate from the name."
        >
          <Input id="slug" name="slug" defaultValue={product?.slug} />
        </Field>
        <Field
          label="Short description"
          htmlFor="shortDescription"
          error={fe.shortDescription}
        >
          <Input
            id="shortDescription"
            name="shortDescription"
            defaultValue={product?.shortDescription}
            required
          />
        </Field>
        <Field label="Full description" htmlFor="description" error={fe.description}>
          <Textarea
            id="description"
            name="description"
            rows={6}
            defaultValue={product?.description}
            required
          />
        </Field>
      </Card>

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Brand" htmlFor="brand" error={fe.brand}>
          <Input id="brand" name="brand" defaultValue={product?.brand} required />
        </Field>
        <Field label="Platform" htmlFor="platform" error={fe.platform}>
          <Input
            id="platform"
            name="platform"
            defaultValue={product?.platform ?? "Windows"}
            required
          />
        </Field>
        <Field label="Region" htmlFor="region" error={fe.region}>
          <Input
            id="region"
            name="region"
            defaultValue={product?.region ?? "Global"}
          />
        </Field>
        <PriceFields
          priceCents={product?.priceCents}
          priceLkrCents={product?.priceLkrCents ?? null}
          costCents={product?.costCents ?? null}
          costCurrency={product?.costCurrency ?? "USD"}
          pricing={pricing}
          usdError={fe.priceCents}
          lkrError={fe.priceLkrCents}
          costError={fe.costCents}
        />
        <Field label="Category" htmlFor="categoryId" error={fe.categoryId}>
          {/* `items` lets the trigger show the name before the popup has opened
              (otherwise Base UI shows the raw value, i.e. the category id). */}
          <Select
            name="categoryId"
            defaultValue={product?.categoryId}
            items={categories.map((c) => ({ value: c.id, label: c.name }))}
          >
            <SelectTrigger id="categoryId" className="w-full">
              <SelectValue placeholder="Pick a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Image URL"
          htmlFor="imageUrl"
          error={fe.imageUrl}
          hint="Optional. Best: 1600 x 1000 px (16:10), product centered - the cart shows a square crop from the middle. Without an image a colored placeholder is shown."
        >
          <ImageUpload
            name="imageUrl"
            defaultValue={product?.imageUrl}
            enabled={uploadsEnabled}
            invalid={Boolean(fe.imageUrl)}
          />
        </Field>
      </Card>

      <Card className="space-y-3 p-5">
        <Field
          label="Low stock alert (optional)"
          htmlFor="lowStockThreshold"
          error={fe.lowStockThreshold}
          hint={`Email me when fewer than this many keys are left. Empty = store default (${defaultLowStock}), set in Settings.`}
        >
          <Input
            id="lowStockThreshold"
            name="lowStockThreshold"
            type="number"
            min={1}
            max={1000}
            step={1}
            placeholder={String(defaultLowStock)}
            defaultValue={product?.lowStockThreshold ?? ""}
            className="sm:max-w-40"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="published"
            defaultChecked={product ? product.published : true}
            className="size-4 rounded border-input"
          />
          Published (visible in the store)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={product?.featured ?? false}
            className="size-4 rounded border-input"
          />
          Featured on the home page
        </label>
      </Card>

      <div className="flex gap-3">
        <SubmitButton isEdit={isEdit} />
        <Link
          href="/admin/products"
          className={cn(buttonVariants({ variant: "ghost" }))}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
