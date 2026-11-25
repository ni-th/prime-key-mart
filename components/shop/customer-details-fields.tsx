"use client";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { CustomerDetails } from "@/lib/validation";

/** Suggestions only; any country can be typed. */
const COUNTRIES = [
  "Sri Lanka", "India", "Maldives", "Bangladesh", "Pakistan", "Nepal", "United Arab Emirates", "Saudi Arabia",
  "Qatar", "Kuwait", "Oman", "Bahrain", "Singapore", "Malaysia", "Thailand", "Japan", "South Korea",
  "Australia", "New Zealand", "United Kingdom", "Ireland", "Germany", "France", "Italy", "Spain",
  "Netherlands", "Sweden", "Norway", "Switzerland", "Canada", "United States",
];

export type CustomerDetailsErrors = Partial<Record<keyof CustomerDetails, string>>;

/**
 * First/last name, phone and country: the billing details PayHere asks for.
 * All required. Limits match customerDetailsSchema (checked again on the server).
 */
export function CustomerDetailsFields({
  value,
  onChange,
  errors,
  disabled,
}: {
  value: CustomerDetails;
  onChange: (next: CustomerDetails) => void;
  errors: CustomerDetailsErrors;
  disabled?: boolean;
}) {
  const field = (key: keyof CustomerDetails) => ({
    id: `customer-${key}`,
    name: key,
    value: value[key],
    disabled,
    required: true,
    "aria-invalid": errors[key] ? true : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [key]: e.target.value }),
  });
  const invalid = (key: keyof CustomerDetails) => (errors[key] ? true : undefined);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field data-invalid={invalid("firstName")}>
        <FieldLabel htmlFor="customer-firstName" required>
          First name
        </FieldLabel>
        <Input {...field("firstName")} autoComplete="given-name" maxLength={50} />
        <FieldError>{errors.firstName}</FieldError>
      </Field>
      <Field data-invalid={invalid("lastName")}>
        <FieldLabel htmlFor="customer-lastName" required>
          Last name
        </FieldLabel>
        <Input {...field("lastName")} autoComplete="family-name" maxLength={50} />
        <FieldError>{errors.lastName}</FieldError>
      </Field>
      <Field data-invalid={invalid("phone")}>
        <FieldLabel htmlFor="customer-phone" required>
          Mobile number
        </FieldLabel>
        <Input
          {...field("phone")}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          maxLength={25}
          // Digits, spaces, brackets, dashes and an optional leading +.
          pattern="\+?[0-9][0-9 ()\-]*"
          title="Digits only, e.g. 077 123 4567 or +94 77 123 4567"
          placeholder="077 123 4567"
        />
        <FieldError>{errors.phone}</FieldError>
      </Field>
      <Field data-invalid={invalid("country")}>
        <FieldLabel htmlFor="customer-country" required>
          Country
        </FieldLabel>
        <Input {...field("country")} autoComplete="country-name" list="checkout-countries" minLength={2} maxLength={56} />
        <datalist id="checkout-countries">
          {COUNTRIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <FieldError>{errors.country}</FieldError>
      </Field>
    </div>
  );
}
