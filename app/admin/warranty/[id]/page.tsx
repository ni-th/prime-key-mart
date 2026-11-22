import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Separator } from "@/components/ui/separator";
import { WarrantyPlanForm } from "@/components/admin/warranty-plan-form";
import { DeleteWarrantyButton } from "@/components/admin/delete-warranty-button";

export const metadata: Metadata = { title: "Edit warranty plan · Admin" };

export default async function EditWarrantyPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await prisma.warrantyPlan.findUnique({ where: { id } });
  if (!plan) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{plan.name}</h1>
      <WarrantyPlanForm
        plan={{
          id: plan.id,
          name: plan.name,
          description: plan.description,
          days: plan.days,
          percent: plan.percent,
          active: plan.active,
          isDefault: plan.isDefault,
          recommended: plan.recommended,
        }}
      />
      <Separator />
      <div>
        <h2 className="text-sm font-medium">Danger zone</h2>
        <p className="mb-3 text-xs text-muted-foreground">Past orders keep their warranty either way.</p>
        <DeleteWarrantyButton id={plan.id} />
      </div>
    </div>
  );
}
