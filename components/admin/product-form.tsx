"use client";

import Link from "next/link";
import { ImageUpload } from "@/components/admin/image-upload";
import { useActionState, useState } from "react";
import { formatMoney } from "@/lib/money";
import { unitProfit, type Currency } from "@/lib/profit";
import { warrantyLength } from "@/lib/warranty";

/** Matches LKR_DRIFT_WARN_PERCENT in lib/pricing.ts (not imported: server-only module). */
const LKR_DRIFT_WARN_PERCENT = 10;
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
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
import { ACTIVATION_REPLY_TIME, DELIVERY_TYPES, type DeliveryType } from "@/lib/delivery";

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
  /** "NONE" = no warranty; "STORE" = all active store plans; "CUSTOM" = the selection below. */
  warrantyMode: WarrantyMode;
  /** Custom selection: planId -> percent override (null = store %). */
  warrantyOverrides: Record<string, number | null>;
  categoryId: string;
  deliveryType: DeliveryType;
  /** "How to activate" steps, one per line. */
  activationSteps: string | null;
  imageUrl: string | null;
  published: boolean;
  featured: boolean;
};

const DELIVERY_HINT: Record<DeliveryType, string> = {
  KEY: "The customer gets a license key.",
  ACCOUNT: "The customer gets a username and password. Add stock as \"username, password\", one per line.",
  PHONE: `The customer gets a key. When the software shows an Installation ID, they send it from their order page and you reply with the Confirmation ID (we promise: ${ACTIVATION_REPLY_TIME}).`,
};

function DeliveryFields({
  type,
  steps,
  error,
}: {
  type: DeliveryType;
  steps: string | null;
  error?: string;
}) {
  const [value, setValue] = useState<DeliveryType>(type);
  return (
    <>
      <ProductField label="Delivery" htmlFor="deliveryType" hint={DELIVERY_HINT[value]} required>
        <Select
          name="deliveryType"
          value={value}
          onValueChange={(v) => setValue((v as DeliveryType) ?? "KEY")}
          items={(Object.keys(DELIVERY_TYPES) as DeliveryType[]).map((t) => ({ value: t, label: DELIVERY_TYPES[t] }))}
        >
          <SelectTrigger id="deliveryType" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(DELIVERY_TYPES) as DeliveryType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {DELIVERY_TYPES[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ProductField>
      <ProductField
        label="How to activate (optional)"
        htmlFor="activationSteps"
        error={error}
        hint="One step per line, up to 3000 characters. Shown with the keys on the order page and in the keys email."
      >
        <Textarea
          id="activationSteps"
          name="activationSteps"
          rows={6}
          maxLength={3000}
          aria-invalid={error ? true : undefined}
          defaultValue={steps ?? ""}
          placeholder={
            value === "PHONE"
              ? [
                  "Install Office 2019.",
                  "Enter your product key.",
                  "Choose phone activation; Office shows an Installation ID.",
                  "Send the Installation ID from your order page.",
                  "Enter the Confirmation ID we send you.",
                ].join("\n")
              : value === "ACCOUNT"
                ? [
                    "Go to office.com and sign in with the username and password.",
                    "Install the apps from your account page.",
                  ].join("\n")
                : ["Open Settings > System > Activation.", "Choose Change product key and enter your key."].join(
                    "\n",
                  )
          }
        />
      </ProductField>
    </>
  );
}

/** Label (with * when required), the input, then its help text or the server's error. */
function ProductField({
  label,
  htmlFor,
  error,
  children,
  hint,
  required,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={htmlFor} required={required}>
        {label}
      </FieldLabel>
      {children}
      {hint && !error && <FieldDescription className="text-xs">{hint}</FieldDescription>}
      <FieldError className="text-xs">{error}</FieldError>
    </Field>
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

export type WarrantyMode = "NONE" | "STORE" | "CUSTOM";

export type WarrantyPlanOption = {
  id: string;
  name: string;
  days: number | null;
  percent: number;
  isDefault: boolean;
};

/** No warranty, the store plans, or this product's own selection and percentages. */
function WarrantyFields({
  plans,
  mode: initialMode,
  overrides,
}: {
  plans: WarrantyPlanOption[];
  mode: WarrantyMode;
  overrides: Record<string, number | null>;
}) {
  const [mode, setMode] = useState(initialMode);
  if (plans.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No warranty plans yet. Create them in{" "}
        <Link href="/admin/warranty" className="underline">
          Admin &gt; Warranty
        </Link>
        , then choose them here for each product that has a warranty.
        <input type="hidden" name="warrantyMode" value="NONE" />
      </p>
    );
  }
  const length = warrantyLength;
  return (
    <div className="space-y-3">
      <input type="hidden" name="warrantyMode" value={mode} />
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Warranty">
        {(
          [
            ["NONE", "No warranty", "This product doesn't offer a warranty."],
            ["STORE", "Store plans", "Every active plan at the store percentages."],
            ["CUSTOM", "Custom", "Choose plans and percentages for this product."],
          ] as const
        ).map(([value, label, hint]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              "rounded-lg border p-3 text-left text-sm transition-colors",
              mode === value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
            )}
          >
            <div className="font-medium">{label}</div>
            <div className="text-xs text-muted-foreground">{hint}</div>
          </button>
        ))}
      </div>

      {mode === "NONE" ? (
        <p className="text-xs text-muted-foreground">
          Customers won&apos;t see any warranty options for this product.
        </p>
      ) : mode === "STORE" ? (
        <p className="text-xs text-muted-foreground">
          Offers:{" "}
          {plans.map((p) => `${p.name} (${length(p.days)}, ${p.isDefault ? "free" : `+${p.percent}%`})`).join(" · ")}
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {plans.map((p) => {
            // Switching to Custom from another mode starts with every plan ticked.
            const on = p.id in overrides || initialMode !== "CUSTOM";
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3 p-2.5 text-sm">
                <label className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    name={`warranty_${p.id}`}
                    defaultChecked={on}
                    className="size-4 rounded border-input"
                  />
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground">{length(p.days)}</span>
                </label>
                {p.isDefault ? (
                  <span className="text-xs text-muted-foreground">Included, free</span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Input
                      name={`warrantyPct_${p.id}`}
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      placeholder={String(p.percent)}
                      defaultValue={overrides[p.id] ?? ""}
                      aria-label={`${p.name} percent for this product`}
                      className="h-8 w-20"
                    />
                    <span className="text-xs text-muted-foreground">% (store: {p.percent}%)</span>
                  </div>
                )}
              </div>
            );
          })}
          <p className="p-2.5 text-xs text-muted-foreground">
            Leave a percentage empty to use the store percentage. Unticked plans aren&apos;t offered on
            this product.
          </p>
        </div>
      )}
    </div>
  );
}

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
      <ProductField label="Price (USD)" htmlFor="price" error={usdError} required>
        <Input
          id="price"
          name="price"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          max="10000"
          aria-invalid={usdError ? true : undefined}
          value={usd}
          onChange={(e) => setUsd(e.target.value)}
          required
        />
      </ProductField>
      <Field data-invalid={lkrError ? true : undefined}>
        <FieldLabel htmlFor="priceLkr">Fixed price in LKR (optional)</FieldLabel>
        <Input
          id="priceLkr"
          name="priceLkr"
          type="number"
          inputMode="numeric"
          step="1"
          min="1"
          max="5000000"
          placeholder={calculated !== null ? String(calculated) : "Calculated from USD"}
          value={lkr}
          onChange={(e) => setLkr(e.target.value)}
          aria-invalid={lkrError ? true : undefined}
        />
        {lkrError ? (
          <FieldError className="text-xs">{lkrError}</FieldError>
        ) : (
          <FieldDescription className="text-xs">
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
          </FieldDescription>
        )}
        {drift !== null && Math.abs(drift) >= LKR_DRIFT_WARN_PERCENT && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            This is {Math.abs(drift)}% {drift > 0 ? "above" : "below"} the USD price at
            today&apos;s rate, so customers paying in {drift > 0 ? "USD" : "LKR"} get a
            better deal.
          </p>
        )}
      </Field>

      <Field data-invalid={costError ? true : undefined}>
        <FieldLabel htmlFor="cost">Your cost per key (optional, private)</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="cost"
            name="cost"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            max="5000000"
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
        {costError ? (
          <FieldError className="text-xs">{costError}</FieldError>
        ) : (
          <FieldDescription className="text-xs">
            Only admins see this. Used to show your real profit after gateway fees.
          </FieldDescription>
        )}
      </Field>

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
  warrantyPlans,
}: {
  categories: Category[];
  product?: ProductFormValues;
  /** Cloudinary configured: show the image uploader instead of a URL box. */
  uploadsEnabled?: boolean;
  /** Current exchange rate, margin and gateway fee, for the price/profit previews. */
  pricing: Pricing;
  /** Store-wide low stock level (Admin -> Settings), shown as the placeholder. */
  defaultLowStock: number;
  /** Active warranty plans (Admin -> Warranty). */
  warrantyPlans: WarrantyPlanOption[];
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
        <ProductField label="Name" htmlFor="name" error={fe.name} hint="2 to 120 characters." required>
          <Input
            id="name"
            name="name"
            defaultValue={product?.name}
            required
            minLength={2}
            maxLength={120}
            aria-invalid={fe.name ? true : undefined}
          />
        </ProductField>
        <ProductField
          label="Slug"
          htmlFor="slug"
          error={fe.slug}
          hint="URL identifier. Leave blank to generate from the name."
        >
          <Input
            id="slug"
            name="slug"
            defaultValue={product?.slug}
            maxLength={120}
            spellCheck={false}
            autoCapitalize="none"
            aria-invalid={fe.slug ? true : undefined}
          />
        </ProductField>
        <ProductField
          label="Short description"
          htmlFor="shortDescription"
          error={fe.shortDescription}
          hint="5 to 200 characters. Shown on product cards."
          required
        >
          <Input
            id="shortDescription"
            name="shortDescription"
            defaultValue={product?.shortDescription}
            minLength={5}
            maxLength={200}
            aria-invalid={fe.shortDescription ? true : undefined}
            required
          />
        </ProductField>
        <ProductField
          label="Full description"
          htmlFor="description"
          error={fe.description}
          hint="10 to 4000 characters."
          required
        >
          <Textarea
            id="description"
            name="description"
            rows={6}
            minLength={10}
            maxLength={4000}
            aria-invalid={fe.description ? true : undefined}
            defaultValue={product?.description}
            required
          />
        </ProductField>
      </Card>

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <ProductField label="Brand" htmlFor="brand" error={fe.brand} required>
          <Input
            id="brand"
            name="brand"
            defaultValue={product?.brand}
            maxLength={60}
            aria-invalid={fe.brand ? true : undefined}
            required
          />
        </ProductField>
        <ProductField label="Platform" htmlFor="platform" error={fe.platform} required>
          <Input
            id="platform"
            name="platform"
            defaultValue={product?.platform ?? "Windows"}
            maxLength={60}
            aria-invalid={fe.platform ? true : undefined}
            required
          />
        </ProductField>
        <ProductField label="Region" htmlFor="region" error={fe.region} hint="Empty = Global.">
          <Input
            id="region"
            name="region"
            defaultValue={product?.region ?? "Global"}
            maxLength={60}
            aria-invalid={fe.region ? true : undefined}
          />
        </ProductField>
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
        <ProductField label="Category" htmlFor="categoryId" error={fe.categoryId} required>
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
        </ProductField>
        <ProductField
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
        </ProductField>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-medium">Delivery and activation</h2>
        <DeliveryFields
          type={product?.deliveryType ?? "KEY"}
          steps={product?.activationSteps ?? null}
          error={fe.activationSteps}
        />
      </Card>

      <Card className="space-y-3 p-5">
        <div>
          <h2 className="font-medium">Warranty</h2>
          <p className="text-sm text-muted-foreground">
            Off by default. Turn it on for products you can guarantee (free replacement if the key
            stops working).
          </p>
        </div>
        <WarrantyFields
          plans={warrantyPlans}
          mode={product?.warrantyMode ?? "NONE"}
          overrides={product?.warrantyOverrides ?? {}}
        />
      </Card>

      <Card className="space-y-3 p-5">
        <ProductField
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
            inputMode="numeric"
            placeholder={String(defaultLowStock)}
            defaultValue={product?.lowStockThreshold ?? ""}
            aria-invalid={fe.lowStockThreshold ? true : undefined}
            className="sm:max-w-40"
          />
        </ProductField>
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
