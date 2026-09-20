import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: z.email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(200, "That password is too long"),
});

export const checkoutSchema = z.object({
  email: z.email("Enter a valid email address").optional(),
  currency: z.enum(["LKR", "USD"]),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(10),
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
  categoryId: z.string().min(1, "Pick a category"),
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
