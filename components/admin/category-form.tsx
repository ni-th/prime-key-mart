"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { saveCategory } from "@/app/actions/categories";
import type { FormResult } from "@/app/actions/admin";
import { ImageUpload } from "@/components/admin/image-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/validation";

export type CategoryFormValues = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  bannerUrl: string | null;
  bannerMobileUrl: string | null;
  visible: boolean;
  showInHeader: boolean;
  sortOrder: number;
};

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
      {isEdit ? "Save changes" : "Create category"}
    </Button>
  );
}

export function CategoryForm({
  category,
  uploadsEnabled,
  nextSortOrder = 0,
}: {
  category?: CategoryFormValues;
  /** Cloudinary configured: show the uploader instead of URL boxes. */
  uploadsEnabled: boolean;
  /** Default display position for a new category (after the last one). */
  nextSortOrder?: number;
}) {
  const [state, formAction] = useActionState<FormResult, FormData>(saveCategory, {
    ok: false,
    error: "",
  });
  const fe = (!state.ok && state.fieldErrors) || {};
  const isEdit = Boolean(category);

  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  // New categories follow the name until the slug is edited by hand.
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const effectiveSlug = slugTouched ? slugify(slug) : slugify(name);
  const slugChanged = isEdit && effectiveSlug !== category?.slug;

  return (
    <form action={formAction} className="space-y-6">
      {category && <input type="hidden" name="id" value={category.id} />}

      {!state.ok && state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Card className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Operating Systems"
              required
              aria-invalid={fe.name ? true : undefined}
            />
            <Hint error={fe.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              value={slugTouched ? slug : effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="operating-systems"
              aria-invalid={fe.slug ? true : undefined}
            />
            <Hint error={fe.slug}>
              {effectiveSlug ? (
                <>
                  Page address: <span className="font-mono">/products?category={effectiveSlug}</span>
                </>
              ) : (
                "Generated from the name."
              )}
            </Hint>
            {slugChanged && !fe.slug && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Changing the slug changes the page address. Old links (shared or indexed by
                Google) will stop showing this category.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            maxLength={300}
            defaultValue={category?.description ?? ""}
            placeholder="Genuine Windows 10 and 11 keys, delivered instantly."
            aria-invalid={fe.description ? true : undefined}
          />
          <Hint error={fe.description}>
            Shown under the category name and in Google search results. 1-2 sentences.
          </Hint>
        </div>
      </Card>

      <Card className="space-y-5 p-5">
        <div>
          <h2 className="font-medium">Banner</h2>
          <p className="text-sm text-muted-foreground">
            Optional. Shown at the top of the category page. Without one, the page shows just
            the name and description.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bannerUrl">Desktop banner</Label>
          <ImageUpload
            name="bannerUrl"
            preset="banner"
            defaultValue={category?.bannerUrl}
            enabled={uploadsEnabled}
            invalid={Boolean(fe.bannerUrl)}
          />
          <Hint error={fe.bannerUrl}>Best: 1920 x 480 px (4:1).</Hint>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bannerMobileUrl">Phone banner (optional)</Label>
          <ImageUpload
            name="bannerMobileUrl"
            preset="bannerMobile"
            defaultValue={category?.bannerMobileUrl}
            enabled={uploadsEnabled}
            invalid={Boolean(fe.bannerMobileUrl)}
          />
          <Hint error={fe.bannerMobileUrl}>
            Best: 1200 x 600 px (2:1). Without it, phones show the desktop banner, which is
            very thin on a small screen, so add one if the banner has text.
          </Hint>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="space-y-1.5 sm:max-w-48">
          <Label htmlFor="sortOrder">Display order</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            step={1}
            defaultValue={category?.sortOrder ?? nextSortOrder}
            aria-invalid={fe.sortOrder ? true : undefined}
          />
          <Hint error={fe.sortOrder}>Lower numbers come first.</Hint>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="visible"
            defaultChecked={category?.visible ?? true}
            className="size-4 rounded border-input"
          />
          Visible in the shop
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="showInHeader"
            defaultChecked={category?.showInHeader ?? true}
            className="size-4 rounded border-input"
          />
          Show in the header menu
        </label>
        <p className="text-xs text-muted-foreground">
          Hidden categories disappear from the menus, home page and their own page. Their
          products stay in &quot;All products&quot; and search; unpublish a product to hide it.
        </p>
      </Card>

      <div className="flex gap-3">
        <SubmitButton isEdit={isEdit} />
        <Link href="/admin/categories" className={cn(buttonVariants({ variant: "ghost" }))}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
