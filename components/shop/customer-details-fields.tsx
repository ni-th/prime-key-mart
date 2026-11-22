"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomerDetails } from "@/lib/validation";

/** Suggestions only; any country can be typed. */
const COUNTRIES = [
  "Sri Lanka", "India", "Maldives", "Bangladesh", "Pakistan", "Nepal", "United Arab Emirates", "Saudi Arabia",
  "Qatar", "Kuwait", "Oman", "Bahrain", "Singapore", "Malaysia", "Thailand", "Japan", "South Korea",
  "Australia", "New Zealand", "United Kingdom", "Ireland", "Germany", "France", "Italy", "Spain",
  "Netherlands", "Sweden", "Norway", "Switzerland", "Canada", "United States",
];

export type CustomerDetailsErrors = Partial<Record<keyof CustomerDetails, string>>;

/** First/last name, phone and country: the billing details PayHere asks for. */
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
    value: value[key],
    disabled,
    "aria-invalid": errors[key] ? true : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [key]: e.target.value }),
  });
  const error = (key: keyof CustomerDetails) =>
    errors[key] ? <p className="text-xs text-destructive">{errors[key]}</p> : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="customer-firstName">First name</Label>
        <Input {...field("firstName")} autoComplete="given-name" maxLength={50} />
        {error("firstName")}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="customer-lastName">Last name</Label>
        <Input {...field("lastName")} autoComplete="family-name" maxLength={50} />
        {error("lastName")}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="customer-phone">Mobile number</Label>
        <Input {...field("phone")} type="tel" autoComplete="tel" inputMode="tel" maxLength={25} placeholder="077 123 4567" />
        {error("phone")}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="customer-country">Country</Label>
        <Input {...field("country")} autoComplete="country-name" list="checkout-countries" maxLength={56} />
        <datalist id="checkout-countries">
          {COUNTRIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {error("country")}
      </div>
    </div>
  );
}
