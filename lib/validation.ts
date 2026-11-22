import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  // Authenticator code; only sent on the second step of an admin login. Kept
  // lenient on purpose: a malformed code must surface as "wrong code"
  // (verifyTotp rejects it), never as "wrong email or password".
  code: z
    .string()
    .trim()
    .max(16)
    .optional()
    .transform((v) => v || undefined),
  /** Cloudflare Turnstile token (see lib/turnstile.ts). */
  turnstile: z.string().max(2048).optional(),
  /** Short-lived ticket from sign-up, for the automatic sign-in after it. */
  ticket: z.string().max(200).optional(),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: z.email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(200, "That password is too long"),
});

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1).max(200),
    password: registerSchema.shape.password,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });

/**
 * Billing details PayHere requires for every payment. Names and phone are
 * checked loosely (customers worldwide), but must look real.
 */
export const customerDetailsSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name").max(50),
  lastName: z.string().trim().min(1, "Enter your last name").max(50),
  phone: z
    .string()
    .trim()
    .max(25)
    .regex(/^\+?[0-9][0-9 ()-]*$/, "Use digits only, e.g. 077 123 4567 or +94 77 123 4567")
    .refine((v) => {
      const digits = v.replace(/\D/g, "").length;
      return digits >= 7 && digits <= 15;
    }, "Enter a full phone number"),
  country: z.string().trim().min(2, "Enter your country").max(56),
});
export type CustomerDetails = z.infer<typeof customerDetailsSchema>;

export const checkoutSchema = z.object({
  email: z.email("Enter a valid email address").optional(),
  customer: customerDetailsSchema,
  /** The buyer ticked "I agree to the terms and refund policy". */
  acceptTerms: z.literal(true, { error: "Please accept the terms and refund policy" }),
  currency: z.enum(["LKR", "USD"]),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(10),
        warrantyPlanId: z.string().min(1).max(64).nullish(),
      }),
    )
    .min(1, "Your cart is empty")
    .max(50),
});

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const productSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(120)
    .regex(slugPattern, "Use lowercase letters, numbers and hyphens only"),
  shortDescription: z.string().trim().min(5, "Add a short description").max(200),
  description: z.string().trim().min(10, "Add a full description").max(4000),
  brand: z.string().trim().min(1, "Brand is required").max(60),
  platform: z.string().trim().min(1, "Platform is required").max(60),
  region: z.string().trim().min(1).max(60).default("Global"),
  priceCents: z
    .number({ error: "Enter a price" })
    .int()
    .min(0, "Price cannot be negative")
    .max(10_000_00, "That price looks too high"),
  /** Optional fixed LKR price in cents; null = calculate from USD. */
  priceLkrCents: z
    .number()
    .int()
    .min(100, "Enter at least LKR 1, or leave it empty")
    .max(5_000_000_00, "That LKR price looks too high")
    .nullable(),
  /** ADMIN ONLY: what the store pays per key, in costCurrency. null = not set. */
  costCents: z
    .number({ error: "Enter a valid cost, or leave it empty" })
    .int()
    .min(0, "Cost cannot be negative")
    .max(5_000_000_00, "That cost looks too high")
    .nullable(),
  costCurrency: z.enum(["USD", "LKR"]).default("USD"),
  /** Alert when available keys fall below this; null = store default. */
  lowStockThreshold: z
    .number({ error: "Enter a whole number, or leave it empty" })
    .int("Use a whole number")
    .min(1, "Use 1 or more")
    .max(1000)
    .nullable(),
  categoryId: z.string().min(1, "Pick a category"),
  deliveryType: z.enum(["KEY", "ACCOUNT", "PHONE"]).default("KEY"),
  activationSteps: z.string().trim().max(3000, "Keep the steps under 3000 characters"),
  imageUrl: z.union([z.url(), z.literal("")]).optional(),
  published: z.boolean().default(true),
  featured: z.boolean().default(false),
});

export const licenseKeyBatchSchema = z.object({
  productId: z.string().min(1),
  raw: z.string().min(1, "Paste at least one key"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ProductInput = z.infer<typeof productSchema>;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const imageUrlField = z.union([z.url("Enter a valid image URL"), z.literal("")]);

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Slug is required")
    .max(60)
    .regex(slugPattern, "Use lowercase letters, numbers and hyphens only"),
  description: z.string().trim().max(300, "Keep it under 300 characters"),
  bannerUrl: imageUrlField,
  bannerMobileUrl: imageUrlField,
  visible: z.boolean(),
  showInHeader: z.boolean(),
});

/** New display order: every category id, first to last. */
export const categoryOrderSchema = z.array(z.string().min(1)).min(1).max(500);

const optionalDate = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date and time" });
      return z.NEVER;
    }
    return d;
  });

export const discountSchema = z
  .object({
    name: z.string().trim().min(2, "Give the sale a name").max(60),
    percent: z
      .number({ error: "Enter the percent off" })
      .min(1, "At least 1% off")
      .max(90, "At most 90% off")
      .refine((n) => Math.round(n * 10) === n * 10, "Use at most one decimal place"),
    scope: z.enum(["ALL", "CATEGORIES", "PRODUCTS"]),
    categoryIds: z.array(z.string().min(1)).max(200),
    productIds: z.array(z.string().min(1)).max(2000),
    active: z.boolean(),
    startsAt: optionalDate,
    endsAt: optionalDate,
  })
  .superRefine((d, ctx) => {
    if (d.scope === "CATEGORIES" && d.categoryIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["categoryIds"], message: "Pick at least one category" });
    }
    if (d.scope === "PRODUCTS" && d.productIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["productIds"], message: "Pick at least one product" });
    }
    if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "The end must be after the start" });
    }
  });
