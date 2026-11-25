import { z } from "zod";

/** Longest valid email address (RFC 5321). */
export const EMAIL_MAX = 254;
/** Longest password accepted anywhere (bcrypt only uses the first 72 bytes anyway). */
export const PASSWORD_MAX = 200;
/** Database ids (cuid) are ~25 characters; anything longer is not an id. */
export const ID_MAX = 64;

/** A required email, trimmed and lower-cased, with a length cap. */
export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX, "That email address is too long")
  .pipe(z.email("Enter a valid email address"));

/** A database id from a form or request. */
export const idField = z.string().trim().min(1).max(ID_MAX);

/**
 * An image URL typed or pasted by an admin: web addresses only, so nothing
 * like "javascript:" or "data:" can end up in an <img src> or link.
 */
export const webUrl = z
  .string()
  .trim()
  .max(2048, "That URL is too long")
  .pipe(z.url({ protocol: /^https?$/, error: "Enter a web address starting with https://" }));

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password").max(PASSWORD_MAX, "That password is too long"),
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

/** First / last name as PayHere wants them (also used at checkout). */
export const personNameSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name").max(50),
  lastName: z.string().trim().min(1, "Enter your last name").max(50),
});

export const registerSchema = z.object({
  ...personNameSchema.shape,
  email: emailField,
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(PASSWORD_MAX, "That password is too long"),
});

/** The 6-digit code emailed at sign-up. */
export const signupCodeSchema = z.object({
  email: emailField,
  code: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().length(6, "Enter the 6-digit code from the email")),
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1).max(200),
    password: registerSchema.shape.password,
    confirm: z.string().max(PASSWORD_MAX),
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
  ...personNameSchema.shape,
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
  email: emailField.optional(),
  customer: customerDetailsSchema,
  /** The buyer ticked "I agree to the terms and refund policy". */
  acceptTerms: z.literal(true, { error: "Please accept the terms and refund policy" }),
  currency: z.enum(["LKR", "USD"]),
  items: z
    .array(
      z.object({
        productId: idField,
        quantity: z.number().int().min(1).max(10),
        warrantyPlanId: idField.nullish(),
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
  categoryId: z.string().trim().min(1, "Pick a category").max(ID_MAX),
  deliveryType: z.enum(["KEY", "ACCOUNT", "PHONE"]).default("KEY"),
  activationSteps: z.string().trim().max(3000, "Keep the steps under 3000 characters"),
  imageUrl: z.union([webUrl, z.literal("")]).optional(),
  published: z.boolean().default(true),
  featured: z.boolean().default(false),
});

/** Most keys (lines) accepted in one paste, and the most text. */
export const KEY_BATCH_MAX_LINES = 5000;
export const KEY_BATCH_MAX_CHARS = 500_000;

export const licenseKeyBatchSchema = z.object({
  productId: idField,
  raw: z
    .string()
    .min(1, "Paste at least one key")
    .max(KEY_BATCH_MAX_CHARS, `That's too much at once: paste at most ${KEY_BATCH_MAX_LINES} keys per batch.`),
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

const imageUrlField = z.union([webUrl, z.literal("")]);

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
export const categoryOrderSchema = z.array(idField).min(1).max(500);

const optionalDate = z
  .string()
  .trim()
  .max(40)
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
    categoryIds: z.array(idField).max(200),
    productIds: z.array(idField).max(2000),
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
