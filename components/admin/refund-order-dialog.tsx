"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Mark refunded
    </Button>
  );
}

export function RefundOrderDialog({
  orderNumber,
  formAction,
}: {
  orderNumber: string;
  formAction: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>
        <RotateCcw className="size-4" />
        Mark refunded
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark this order as refunded?</DialogTitle>
          <DialogDescription>
            This records the order as refunded. Issue the actual money-back in
            your payment provider separately — delivered keys are not revoked.
          </DialogDescription>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={() => setOpen(false)}
          className="space-y-3"
        >
          <input type="hidden" name="orderNumber" value={orderNumber} />
          <input type="hidden" name="action" value="refund" />
          <div className="space-y-1.5">
            <Label htmlFor="refund-note">Refund note (optional)</Label>
            <Textarea
              id="refund-note"
              name="note"
              rows={3}
              maxLength={1000}
              placeholder="Reason, support ticket, amount refunded…"
            />
            <p className="text-xs text-muted-foreground">
              Saved on the order for your records.
            </p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" type="button" />}>
              Cancel
            </DialogClose>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
