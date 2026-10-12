"use client";

import { useActionState, useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { createRole, updateRole } from "@/actions/role";
import { FormField } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState } from "@/lib/form-state";

type RoleFormDialogProps = {
  // Existing role to edit; omit to create one.
  role?: { id: number; name: string; description: string | null; reserved: boolean };
  trigger: ReactNode;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
};

export function RoleFormDialog({ role, trigger, triggerLabel, triggerVariant = "outline" }: RoleFormDialogProps) {
  const [open, setOpen] = useState(false);
  // Stable, so the form's effect runs once per result (not on every render).
  const close = useCallback(() => setOpen(false), []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size="sm" aria-label={triggerLabel} />}>
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role ? `Edit role "${role.name}"` : "New role"}</DialogTitle>
          <DialogDescription>
            {role?.reserved
              ? "This is a reserved role: its name cannot change."
              : "Use a lowercase kebab-case name, such as content-editor."}
          </DialogDescription>
        </DialogHeader>
        <RoleForm role={role} onDone={close} />
      </DialogContent>
    </Dialog>
  );
}

// Mounted only while the dialog is open, so it starts fresh each time.
function RoleForm({ role, onDone }: { role?: RoleFormDialogProps["role"]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(role ? updateRole : createRole, initialFormState);
  const errors = state.ok ? undefined : state.fieldErrors;
  const values = state.values;

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  return (
    <form key={state.ok ? "ok" : JSON.stringify(values)} action={formAction} className="grid gap-4" noValidate>
      {role && <input type="hidden" name="id" value={role.id} />}
      <FormField id="role-name" label="Name" error={errors?.name}>
        {(aria) => (
          <Input
            {...aria}
            name="name"
            defaultValue={values?.name ?? role?.name}
            readOnly={role?.reserved}
            autoComplete="off"
            required
          />
        )}
      </FormField>
      <FormField id="role-description" label="Description" error={errors?.description}>
        {(aria) => (
          <Textarea {...aria} name="description" rows={3} defaultValue={values?.description ?? role?.description ?? ""} />
        )}
      </FormField>
      {!state.ok && !state.fieldErrors && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : role ? "Save role" : "Create role"}
      </Button>
    </form>
  );
}
