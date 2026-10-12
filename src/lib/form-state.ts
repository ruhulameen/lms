import type { ActionResult } from "@/lib/action-result";

// State of a useActionState form: the action result plus the submitted values,
// so the form can refill its fields after a validation error.
export type FormState = ActionResult & { values?: Record<string, string> };

export const initialFormState: FormState = { ok: true };

export function formValues(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    // Passwords are never sent back to the browser.
    if (typeof value === "string" && !/password/i.test(key)) values[key] = value;
  }
  return values;
}
