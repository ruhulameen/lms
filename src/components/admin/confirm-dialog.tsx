"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  // Server action to run on confirm; receives `fields` as FormData. A returned
  // ActionResult is shown as a toast (message on success, error on failure).
  action: (formData: FormData) => Promise<ActionResult | void>;
  // Hidden inputs sent with the action, e.g. { id: "12" }.
  fields?: Record<string, string>;
  title: string;
  description: string;
  // Content of the button that opens the dialog.
  trigger: ReactNode;
  triggerVariant?: "default" | "outline" | "ghost" | "destructive";
  triggerLabel?: string;
  confirmLabel?: string;
  // Red confirm button for irreversible actions.
  destructive?: boolean;
};

export function ConfirmDialog({
  action,
  fields,
  title,
  description,
  trigger,
  triggerVariant = "outline",
  triggerLabel,
  confirmLabel = "Confirm",
  destructive = false,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(formData: FormData) {
    startTransition(async () => {
      const result = await action(formData);
      if (result && !result.ok) {
        toast.error(result.error);
        return;
      }
      if (result?.message) toast.success(result.message);
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant={triggerVariant} size="sm" aria-label={triggerLabel} />}
      >
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <form action={run}>
          {Object.entries(fields ?? {}).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              disabled={pending}
            >
              {pending ? "Working..." : confirmLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
