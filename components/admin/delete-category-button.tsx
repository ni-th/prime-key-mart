"use client";

import { useActionState, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteCategory } from "@/app/actions/categories";
import type { FormResult } from "@/app/actions/admin";

export function DeleteCategoryButton({ id }: { id: string }) {
  const [state, formAction] = useActionState<FormResult, FormData>(deleteCategory, {
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
        triggerText="Delete category"
        triggerIcon={<Trash2 className="size-4" />}
        triggerVariant="destructive"
        title="Delete this category?"
        description="This permanently removes the category. Categories that still have products can't be deleted - move the products first, or hide the category instead."
        confirmText="Delete category"
        confirmVariant="destructive"
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </div>
  );
}
