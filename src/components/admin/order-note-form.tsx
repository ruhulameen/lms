"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { addOrderNoteAction } from "@/actions/order-admin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState } from "@/lib/form-state";
import { ORDER_NOTE_MAX } from "@/lib/order-display";

// Adds a staff note to the order's timeline (order.manage).
export function OrderNoteForm({ orderId }: { orderId: number }) {
  const [state, formAction, pending] = useActionState(addOrderNoteAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const error = state.ok ? undefined : (state.fieldErrors?.note?.[0] ?? state.error);

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <label htmlFor="order-note" className="text-sm font-medium">
        Add a staff note
      </label>
      <Textarea
        id="order-note"
        name="note"
        rows={3}
        maxLength={ORDER_NOTE_MAX}
        defaultValue={state.ok ? undefined : state.values?.note}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "order-note-error" : "order-note-hint"}
      />
      <p id="order-note-hint" className="text-xs text-slate-500">
        Only staff see notes. They appear on the timeline with your name.
      </p>
      {error && (
        <p id="order-note-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding..." : "Add note"}
        </Button>
      </div>
    </form>
  );
}
