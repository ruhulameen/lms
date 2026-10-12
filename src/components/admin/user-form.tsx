"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { createUser, updateUser } from "@/actions/user";
import { FormField, selectClassName } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/form-state";

type UserFormProps = {
  mode: "create" | "edit";
  roles: { id: number; name: string }[];
  // Edit mode: the user being edited.
  user?: { id: number; name: string; email: string; roleId: number | null };
  // Edit mode: viewer lacks user.edit.
  readOnly?: boolean;
  // Edit mode: why the role select is locked (own account), if it is.
  roleLockedReason?: string;
};

export function UserForm({ mode, roles, user, readOnly, roleLockedReason }: UserFormProps) {
  const [state, formAction, pending] = useActionState(
    mode === "create" ? createUser : updateUser,
    initialFormState,
  );
  const errors = state.ok ? undefined : state.fieldErrors;
  const values = state.values;

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  // Remounted with the submitted values after a failed save so fields refill.
  const formKey = state.ok ? "ok" : JSON.stringify(values);
  const roleValue = values?.roleId ?? String(user?.roleId ?? "");

  return (
    <form key={formKey} action={formAction} className="grid max-w-xl gap-5" noValidate>
      {user && <input type="hidden" name="id" value={user.id} />}
      <FormField id="name" label="Name" error={errors?.name}>
        {(aria) => (
          <Input
            {...aria}
            name="name"
            autoComplete="off"
            defaultValue={values?.name ?? user?.name}
            disabled={readOnly}
            required
          />
        )}
      </FormField>
      <FormField id="email" label="Email address" error={errors?.email}>
        {(aria) => (
          <Input
            {...aria}
            name="email"
            type="email"
            autoComplete="off"
            defaultValue={values?.email ?? user?.email}
            disabled={readOnly}
            required
          />
        )}
      </FormField>
      <FormField id="roleId" label="Role" error={errors?.roleId} hint={roleLockedReason}>
        {(aria) => (
          <>
            <select
              {...aria}
              name={roleLockedReason ? undefined : "roleId"}
              defaultValue={roleValue}
              disabled={readOnly || Boolean(roleLockedReason)}
              className={selectClassName}
              required
            >
              {mode === "create" && <option value="">Choose a role</option>}
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {roleLockedReason && <input type="hidden" name="roleId" value={roleValue} />}
          </>
        )}
      </FormField>
      {mode === "create" && (
        <FormField
          id="password"
          label="Initial password"
          error={errors?.password}
          hint="At least 8 characters. Email delivery is not set up yet, so tell the user this password yourself."
        >
          {(aria) => (
            <Input {...aria} name="password" type="password" autoComplete="new-password" minLength={8} required />
          )}
        </FormField>
      )}

      {!state.ok && !state.fieldErrors && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p role="status" className="text-sm text-emerald-700">
          {state.message}
        </p>
      )}

      {!readOnly && (
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : mode === "create" ? "Create user" : "Save changes"}
          </Button>
        </div>
      )}
    </form>
  );
}
