"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createRole, updateRole } from "@/actions/role";
import { FormField } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState } from "@/lib/form-state";
import { permissionGroups } from "@/lib/permissions";

type RoleFormProps = {
  mode: "create" | "edit";
  // Edit mode: the role being edited, with the keys it holds now.
  role?: { id: number; name: string; description: string | null; keys: string[] };
};

export function RoleForm({ mode, role }: RoleFormProps) {
  const [state, formAction, pending] = useActionState(mode === "create" ? createRole : updateRole, initialFormState);
  const errors = state.ok ? undefined : state.fieldErrors;

  // Controlled, because React resets an uncontrolled form after every submit
  // and a failed save must keep what was typed and ticked.
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [checked, setChecked] = useState(() => new Set(role?.keys ?? []));

  function toggle(key: string, on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function setGroup(keys: string[], on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  return (
    <form action={formAction} className="grid max-w-4xl gap-6" noValidate>
      {role && <input type="hidden" name="id" value={role.id} />}

      <section aria-label="Role" className="grid gap-4 rounded-xl border bg-white p-4 sm:p-6">
        <FormField
          id="name"
          label="Name"
          error={errors?.name}
          hint="Lowercase letters, numbers and single hyphens, e.g. content-editor."
        >
          {(aria) => (
            <Input {...aria} name="name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} required />
          )}
        </FormField>
        <FormField id="description" label="Description" error={errors?.description}>
          {(aria) => (
            <Textarea {...aria} name="description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          )}
        </FormField>
      </section>

      <div className="grid gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Permissions</h2>
          <p className="text-sm text-slate-500">
            {checked.size} selected. Tick what people with this role may do.
          </p>
        </div>
        {permissionGroups.map((group) => {
          const keys: string[] = group.permissions.map((p) => p.key);
          const selected = keys.filter((k) => checked.has(k)).length;
          return (
            <fieldset key={group.key} className="min-w-0 rounded-xl border bg-white p-4 sm:p-6">
              <legend className="sr-only">{group.label}</legend>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900" aria-hidden>
                  {group.label}{" "}
                  <span className="font-normal text-slate-500">
                    ({selected}/{keys.length})
                  </span>
                </h3>
                <span className="flex gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => setGroup(keys, true)}
                    className="font-medium text-blue-700 hover:underline"
                    aria-label={`Select all ${group.label} permissions`}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroup(keys, false)}
                    className="font-medium text-blue-700 hover:underline"
                    aria-label={`Clear all ${group.label} permissions`}
                  >
                    Clear
                  </button>
                </span>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {group.permissions.map((permission) => (
                  <li key={permission.key}>
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        name="permissions"
                        value={permission.key}
                        checked={checked.has(permission.key)}
                        onChange={(e) => toggle(permission.key, e.target.checked)}
                        className="mt-0.5 size-4 shrink-0 accent-blue-700"
                      />
                      <span>
                        <span className="font-medium text-slate-900">{permission.label}</span>
                        <span className="block text-xs text-slate-500">{permission.description}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          );
        })}
      </div>

      {!state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : mode === "create" ? "Create role" : "Save changes"}
        </Button>
        <Button variant="ghost" render={<Link href={role ? `/admin/roles/${role.id}` : "/admin/roles"} />}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
