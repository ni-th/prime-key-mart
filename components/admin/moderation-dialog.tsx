"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
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

type ButtonVariant = React.ComponentProps<typeof Button>["variant"];
type ButtonSize = React.ComponentProps<typeof Button>["size"];

function SubmitButton({
  label,
  variant,
}: {
  label: string;
  variant: ButtonVariant;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {label}
    </Button>
  );
}

/**
 * A moderation modal: a trigger button that opens a dialog with an optional
 * note field, submitting a form (with caller-supplied hidden fields) through
 * `formAction` — typically the dispatch from the parent's useActionState.
 */
export function ModerationDialog({
  triggerText,
  triggerIcon,
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerDisabled,
  title,
  description,
  fields,
  noteLabel,
  notePlaceholder,
  noteDefaultValue,
  confirmText,
  confirmVariant = "default",
  formAction,
}: {
  triggerText: string;
  triggerIcon?: ReactNode;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  triggerDisabled?: boolean;
  title: string;
  description: ReactNode;
  fields: Record<string, string>;
  noteLabel?: string;
  notePlaceholder?: string;
  noteDefaultValue?: string;
  confirmText: string;
  confirmVariant?: ButtonVariant;
  formAction: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={triggerVariant}
            size={triggerSize}
            disabled={triggerDisabled}
          />
        }
      >
        {triggerIcon}
        {triggerText}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={() => setOpen(false)}
          className="space-y-3"
        >
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {noteLabel && (
            <div className="space-y-1.5">
              <Label htmlFor="mod-note">{noteLabel}</Label>
              <Textarea
                id="mod-note"
                name="note"
                rows={3}
                maxLength={1000}
                defaultValue={noteDefaultValue}
                placeholder={notePlaceholder}
              />
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" type="button" />}>
              Cancel
            </DialogClose>
            <SubmitButton label={confirmText} variant={confirmVariant} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
