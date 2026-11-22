import type { Metadata } from "next";
import { WarrantyPlanForm } from "@/components/admin/warranty-plan-form";

export const metadata: Metadata = { title: "New warranty plan · Admin" };

export default function NewWarrantyPlanPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New warranty plan</h1>
      <WarrantyPlanForm />
    </div>
  );
}
