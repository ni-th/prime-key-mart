"use client";

import { useActionState, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteProduct, type FormResult } from "@/app/actions/admin";

export function DeleteProductButton({ id }: { id: string }) {
  const [state, formAction] = useActionState<FormResult, FormData>(
    deleteProduct,
    { ok: false, error: "" },
  );
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
        triggerText="Delete product"
        triggerIcon={<Trash2 className="size-4" />}
        triggerVariant="destructive"
        title="Delete this product?"
        description="This permanently removes the product and any unsold keys. Products that appear in past orders can't be deleted - unpublish them instead."
        confirmText="Delete product"
        confirmVariant="destructive"
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </div>
  );
}
