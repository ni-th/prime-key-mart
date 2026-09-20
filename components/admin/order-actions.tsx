"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  resendOrderEmail,
  updateOrderStatus,
  type FormResult,
} from "@/app/actions/admin";

const INITIAL: FormResult = { ok: false, error: "" };

function ResendButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Mail className="size-4" />
      )}
      Resend keys email
    </Button>
  );
}

function Result({ state }: { state: FormResult }) {
  if (state.ok && state.message) {
    return (
      <Alert className="mt-2">
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  if (!state.ok && state.error) {
    return (
      <Alert variant="destructive" className="mt-2">
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

export function OrderActions({
  orderNumber,
  status,
}: {
  orderNumber: string;
  status: string;
}) {
  const [resendState, resendAction] = useActionState<FormResult, FormData>(
    (_p, fd) => resendOrderEmail(fd),
    INITIAL,
  );
  const [statusState, statusAction] = useActionState<FormResult, FormData>(
    (_p, fd) => updateOrderStatus(fd),
    INITIAL,
  );

  const cancelRef = useRef<HTMLFormElement>(null);
  const refundRef = useRef<HTMLFormElement>(null);
  const fulfillRef = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-4">
      {status === "FULFILLED" && (
        <form action={resendAction}>
          <input type="hidden" name="orderNumber" value={orderNumber} />
          <ResendButton />
          <Result state={resendState} />
        </form>
      )}

      {(status === "PENDING" || status === "PAID") && (
        <div>
          <form ref={fulfillRef} action={statusAction} className="hidden">
            <input type="hidden" name="orderNumber" value={orderNumber} />
            <input type="hidden" name="action" value="fulfill" />
          </form>
          <ConfirmDialog
            triggerText="Mark as paid & deliver keys"
            title="Deliver keys for this order?"
            description="Use this only if you've confirmed the payment succeeded with the payment provider but the order is stuck (e.g. a missed webhook). This sells the reserved keys, marks the order fulfilled, and emails the keys to the customer immediately."
            confirmText="Deliver keys"
            onConfirm={() => fulfillRef.current?.requestSubmit()}
          />
        </div>
      )}

      {status === "PENDING" && (
        <div>
          <form ref={cancelRef} action={statusAction} className="hidden">
            <input type="hidden" name="orderNumber" value={orderNumber} />
            <input type="hidden" name="action" value="cancel" />
          </form>
          <ConfirmDialog
            triggerText="Cancel & release keys"
            title="Cancel this order?"
            description="The reserved keys go back into stock and the order is marked cancelled. This can't be undone."
            confirmText="Cancel order"
            confirmVariant="destructive"
            onConfirm={() => cancelRef.current?.requestSubmit()}
          />
        </div>
      )}

      {(status === "FULFILLED" || status === "PAID") && (
        <div>
          <form ref={refundRef} action={statusAction} className="hidden">
            <input type="hidden" name="orderNumber" value={orderNumber} />
            <input type="hidden" name="action" value="refund" />
          </form>
          <ConfirmDialog
            triggerText="Mark refunded"
            triggerVariant="destructive"
            title="Mark this order as refunded?"
            description="This records the order as refunded. Issue the actual refund in your payment provider separately. Delivered keys are not revoked."
            confirmText="Mark refunded"
            confirmVariant="destructive"
            onConfirm={() => refundRef.current?.requestSubmit()}
          />
        </div>
      )}

      <Result state={statusState} />
    </div>
  );
}
