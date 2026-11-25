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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
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
};

/** The server's error for a field, or its help text. */
function Hint({ error, children }: { error?: string; children?: React.ReactNode }) {
  if (error) return <FieldError className="text-xs">{error}</FieldError>;
  if (!children) return null;
  return <FieldDescription className="text-xs">{children}</FieldDescription>;
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
}: {
  category?: CategoryFormValues;
  /** Cloudinary configured: show the uploader instead of URL boxes. */
  uploadsEnabled: boolean;
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
          <Field data-invalid={fe.name ? true : undefined}>
            <FieldLabel htmlFor="name" required>
              Name
            </FieldLabel>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Operating Systems"
              minLength={2}
              maxLength={60}
              required
              aria-invalid={fe.name ? true : undefined}
            />
            <Hint error={fe.name}>2 to 60 characters.</Hint>
          </Field>
          <Field data-invalid={fe.slug ? true : undefined}>
            <FieldLabel htmlFor="slug">Slug</FieldLabel>
            <Input
              id="slug"
              name="slug"
              // Cleaned up on the server (lowercase, hyphens); empty = from the name.
              maxLength={60}
              spellCheck={false}
              autoCapitalize="none"
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
                  Page address: <span className="font-mono">/category/{effectiveSlug}</span>
                </>
              ) : (
                "Generated from the name."
              )}
            </Hint>
            {slugChanged && !fe.slug && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                This changes the page address. The old address will keep working and
                redirect here automatically.
              </p>
            )}
          </Field>
        </div>

        <Field data-invalid={fe.description ? true : undefined}>
          <FieldLabel htmlFor="description">Description (optional)</FieldLabel>
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
            Shown under the category name and in Google search results. 1-2 sentences, up to 300 characters.
          </Hint>
        </Field>
      </Card>

      <Card className="space-y-5 p-5">
        <div>
          <h2 className="font-medium">Banner</h2>
          <p className="text-sm text-muted-foreground">
            Optional. Shown at the top of the category page. Without one, the page shows just
            the name and description.
          </p>
        </div>
        <Field data-invalid={fe.bannerUrl ? true : undefined}>
          <FieldLabel htmlFor="bannerUrl">Desktop banner</FieldLabel>
          <ImageUpload
            name="bannerUrl"
            preset="banner"
            defaultValue={category?.bannerUrl}
            enabled={uploadsEnabled}
            invalid={Boolean(fe.bannerUrl)}
          />
          <Hint error={fe.bannerUrl}>Best: 1920 x 480 px (4:1).</Hint>
        </Field>
        <Field data-invalid={fe.bannerMobileUrl ? true : undefined}>
          <FieldLabel htmlFor="bannerMobileUrl">Phone banner (optional)</FieldLabel>
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
        </Field>
      </Card>

      <Card className="space-y-4 p-5">
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
