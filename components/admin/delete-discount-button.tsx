"use client";

import { useActionState, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteDiscount } from "@/app/actions/discounts";
import type { FormResult } from "@/app/actions/admin";

export function DeleteDiscountButton({ id }: { id: string }) {
  const [state, formAction] = useActionState<FormResult, FormData>(deleteDiscount, {
    ok: false,
    error: "",
  });
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
        triggerText="Delete sale"
        triggerIcon={<Trash2 className="size-4" />}
        triggerVariant="destructive"
        title="Delete this sale?"
        description="Prices go back to normal straight away. Past orders keep the discount they got."
        confirmText="Delete sale"
        confirmVariant="destructive"
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </div>
  );
}
