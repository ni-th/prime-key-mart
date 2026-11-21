"use client";

import Link from "next/link";
import { ImageUpload } from "@/components/admin/image-upload";
import { useActionState } from "react";
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

export function ProductForm({
  categories,
  product,
  uploadsEnabled = false,
}: {
  categories: Category[];
  product?: ProductFormValues;
  /** Cloudinary configured: show the image uploader instead of a URL box. */
  uploadsEnabled?: boolean;
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
        <Field label="Price (USD)" htmlFor="price" error={fe.priceCents}>
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={
              product ? (product.priceCents / 100).toFixed(2) : undefined
            }
            required
          />
        </Field>
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
