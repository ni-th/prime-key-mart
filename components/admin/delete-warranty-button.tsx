"use client";

import { useActionState, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteWarrantyPlan } from "@/app/actions/warranty";
import type { FormResult } from "@/app/actions/admin";

export function DeleteWarrantyButton({ id }: { id: string }) {
  const [state, formAction] = useActionState<FormResult, FormData>(deleteWarrantyPlan, { ok: false, error: "" });
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <div className="space-y-2">
      {!state.ok && state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <form ref={formRef} action={formAction} className="hidden">
        <input type="hidden" name="id" value={id} />
      </form>
      <ConfirmDialog
        triggerText="Delete plan"
        triggerIcon={<Trash2 className="size-4" />}
        triggerVariant="destructive"
        title="Delete this warranty plan?"
        description="It disappears from every product. Past orders keep the warranty they bought. To stop offering it for now, untick Active instead."
        confirmText="Delete plan"
        confirmVariant="destructive"
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </div>
  );
}
