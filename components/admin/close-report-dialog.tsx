"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, MailX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
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

const DEFAULT_MESSAGE =
  "We checked with our payment provider (PayHere) and couldn't find a completed payment for this order, so no keys were sent. If money was taken from your account, please reply to this email with a screenshot of the transaction from your bank or card statement and we'll look into it.";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Close and email customer
    </Button>
  );
}

/** "Not paid": close a customer's report with a message that is emailed to them. */
export function CloseReportDialog({
  orderNumber,
  customerEmail,
  formAction,
}: {
  orderNumber: string;
  customerEmail: string;
  formAction: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <MailX className="size-4" />
        Not paid - close report
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Close the report as not paid?</DialogTitle>
          <DialogDescription>
            Only after checking PayHere shows no successful payment for {orderNumber}. Your
            message is emailed to {customerEmail} and shown on their order page.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} onSubmit={() => setOpen(false)} className="space-y-3">
          <input type="hidden" name="orderNumber" value={orderNumber} />
          <input type="hidden" name="action" value="dismiss-report" />
          <Field>
            <FieldLabel htmlFor="close-message" required>
              Message to the customer
            </FieldLabel>
            <Textarea
              id="close-message"
              name="note"
              rows={6}
              minLength={10}
              maxLength={1000}
              required
              defaultValue={DEFAULT_MESSAGE}
            />
            <FieldDescription className="text-xs">
              Edit as needed. 10 to 1000 characters. The customer can reply to the email, and can send one follow-up
              report from their order page.
            </FieldDescription>
          </Field>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" type="button" />}>Cancel</DialogClose>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
