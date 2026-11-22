"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RefundOrderDialog } from "@/components/admin/refund-order-dialog";
import { CloseReportDialog } from "@/components/admin/close-report-dialog";
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
  openReport = false,
  customerEmail,
}: {
  orderNumber: string;
  status: string;
  customerEmail: string;
  /** Customer reported "paid but no keys" and it isn't handled yet. */
  openReport?: boolean;
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
  const fulfillRef = useRef<HTMLFormElement>(null);
  const lapsed = status === "EXPIRED" || status === "FAILED";

  return (
    <div className="space-y-4">
      {status === "FULFILLED" && (
        <form action={resendAction}>
          <input type="hidden" name="orderNumber" value={orderNumber} />
          <ResendButton />
          <Result state={resendState} />
        </form>
      )}

      {(status === "PENDING" || status === "PAID" || lapsed) && (
        <div>
          <form ref={fulfillRef} action={statusAction} className="hidden">
            <input type="hidden" name="orderNumber" value={orderNumber} />
            <input type="hidden" name="action" value="fulfill" />
          </form>
          <ConfirmDialog
            triggerText="Mark as paid & deliver keys"
            title="Deliver keys for this order?"
            description={`First find order ${orderNumber} in your PayHere merchant dashboard and check the payment succeeded for the full amount. This then ${lapsed ? "reserves keys from stock" : "uses the reserved keys"}, marks the order delivered and emails the keys to the customer immediately.`}
            confirmText="Deliver keys"
            onConfirm={() => fulfillRef.current?.requestSubmit()}
          />
        </div>
      )}

      {openReport && (
        <CloseReportDialog
          orderNumber={orderNumber}
          customerEmail={customerEmail}
          formAction={statusAction}
        />
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
        <RefundOrderDialog
          orderNumber={orderNumber}
          formAction={statusAction}
        />
      )}

      <Result state={statusState} />
    </div>
  );
}
