/**
 * Business / contact details shown on the Contact page, policies and footer.
 * Set them as environment variables (locally in .env, in production on Vercel)
 * so they can change without a code change. Anything left empty is simply not
 * shown. PayHere requires a contact email, phone and business address on the
 * site before it approves a live merchant account.
 */
export const BUSINESS = {
  /** Registered business / trading name, e.g. "Keysby (Pvt) Ltd". */
  legalName: process.env.BUSINESS_NAME?.trim() || "Keysby",
  /** Where customers write to. Falls back to the admin alert address. */
  email: process.env.SUPPORT_EMAIL?.trim() || process.env.ADMIN_EMAIL?.trim() || "",
  phone: process.env.SUPPORT_PHONE?.trim() || "",
  /** Postal address, one line (commas are fine). */
  address: process.env.BUSINESS_ADDRESS?.trim() || "",
  /** Optional company registration number. */
  registrationNo: process.env.BUSINESS_REG_NO?.trim() || "",
  /** Country whose law governs the terms. */
  country: process.env.BUSINESS_COUNTRY?.trim() || "Sri Lanka",
} as const;

/** Date shown as "Last updated" on the policy pages. Bump when they change. */
export const POLICIES_UPDATED = "21 November 2026";
