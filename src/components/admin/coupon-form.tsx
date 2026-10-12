"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Dices } from "lucide-react";
import { toast } from "sonner";
import { createCouponAction, updateCouponAction } from "@/actions/coupon";
import { CouponPicker } from "@/components/admin/coupon-picker";
import { FormField, selectClassName } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toDatetimeLocalValue } from "@/lib/content-status";
import { COUPON_DESCRIPTION_MAX, COUPON_NOTE_MAX, couponTypeLabels, generateCouponCode } from "@/lib/coupon-form";
import { initialFormState } from "@/lib/form-state";

export type CouponFormValues = {
  id?: number;
  code: string;
  description: string | null;
  internalNote: string | null;
  discountType: "PERCENTAGE" | "FIXED";
  value: number;
  active: boolean;
  // ISO instants; shown in the browser's own time zone.
  startsAt: string | null;
  expiresAt: string | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  minSpend: number | null;
  courseIds: number[];
  categoryIds: number[];
  // Counted uses, to warn when the code or the value changes.
  uses: number;
  redemptions: number;
};

type CouponFormProps = {
  mode: "create" | "edit";
  coupon?: CouponFormValues;
  courses: { id: number; title: string }[];
  categories: { id: number; name: string }[];
  // Saying where a copied coupon came from.
  copiedFrom?: string;
  // Viewers without coupon.manage see the rules but cannot change them.
  readOnly?: boolean;
};

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="grid gap-4 rounded-xl border bg-white p-4 sm:p-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

// A date-time input in the browser's time zone. `saved` is the stored instant;
// `submitted` is what the last (failed) save sent, which wins so that a cleared
// field stays cleared.
function DateTimeInput({ id, name, saved, submitted, error, describedBy }: { id: string; name: string; saved: string | null; submitted?: string; error?: string[]; describedBy?: string }) {
  return (
    <Input
      id={id}
      name={name}
      type="datetime-local"
      aria-invalid={Boolean(error?.[0])}
      aria-describedby={describedBy}
      ref={(el) => {
        if (el && !el.value) {
          el.value = submitted !== undefined ? submitted : saved ? toDatetimeLocalValue(new Date(saved), new Date().getTimezoneOffset()) : "";
        }
      }}
    />
  );
}

export function CouponForm({ mode, coupon, courses, categories, copiedFrom, readOnly }: CouponFormProps) {
  const [state, formAction, pending] = useActionState(mode === "create" ? createCouponAction : updateCouponAction, initialFormState);
  const errors = state.ok ? undefined : state.fieldErrors;
  const values = state.values;

  // Kept in state because they change what other fields mean, and the form is not remounted after an error.
  const [code, setCode] = useState(coupon?.code ?? "");
  const [type, setType] = useState<"PERCENTAGE" | "FIXED">(coupon?.discountType ?? "PERCENTAGE");
  const [value, setValue] = useState(coupon ? String(coupon.value) : "");
  const [active, setActive] = useState(coupon?.active ?? true);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  const changedWhileUsed =
    mode === "edit" && coupon && coupon.redemptions > 0 && (code.trim().toUpperCase() !== coupon.code || type !== coupon.discountType || Number(value) !== coupon.value);
  const percent = type === "PERCENTAGE";

  return (
    <form action={formAction} className="max-w-3xl" noValidate>
      <fieldset disabled={readOnly} className="grid min-w-0 gap-6">
      {coupon?.id && <input type="hidden" name="id" value={coupon.id} />}
      {copiedFrom && (
        <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          Copied from {copiedFrom}. Give the new coupon its own code before saving.
        </p>
      )}

      <Card title="Coupon" description="What learners type at checkout, and what it is for.">
        <FormField
          id="coupon-code"
          label="Code"
          error={errors?.code}
          hint="Letters, numbers, hyphens and underscores, 2 to 32 characters. Learners can type it in any case; it is stored in capitals."
        >
          {(aria) => (
            <div className="flex gap-2">
              <Input
                {...aria}
                name="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={32}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
              />
              <Button type="button" variant="outline" onClick={() => setCode(generateCouponCode())}>
                <Dices aria-hidden /> Generate
              </Button>
            </div>
          )}
        </FormField>
        {changedWhileUsed && (
          <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This coupon has already been used. Orders keep the discount they were given and still show the old code; only new orders use the new code or value.
          </p>
        )}
        <FormField id="coupon-description" label="Description" error={errors?.description} hint="Optional. A short reminder of what the coupon is for.">
          {(aria) => <Input {...aria} name="description" defaultValue={values?.description ?? coupon?.description ?? ""} maxLength={COUPON_DESCRIPTION_MAX} autoComplete="off" />}
        </FormField>
        <FormField id="coupon-note" label="Internal note" error={errors?.internalNote} hint="Optional. Only staff see this, for example which campaign it belongs to.">
          {(aria) => <Textarea {...aria} name="internalNote" rows={3} defaultValue={values?.internalNote ?? coupon?.internalNote ?? ""} maxLength={COUPON_NOTE_MAX} />}
        </FormField>
        <div className="flex items-center gap-3">
          <Switch id="coupon-active" checked={active} onCheckedChange={setActive} />
          <input type="hidden" name="active" value={active ? "on" : ""} />
          <Label htmlFor="coupon-active">Switched on</Label>
        </div>
        <p className="-mt-2 text-xs text-slate-500">A switched-off coupon is refused at checkout whatever its dates say.</p>
      </Card>

      <Card title="Discount">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="coupon-type" label="Type" error={errors?.discountType}>
            {(aria) => (
              <select {...aria} name="discountType" value={type} onChange={(e) => setType(e.target.value as "PERCENTAGE" | "FIXED")} className={selectClassName}>
                {(Object.keys(couponTypeLabels) as (keyof typeof couponTypeLabels)[]).map((t) => (
                  <option key={t} value={t}>
                    {couponTypeLabels[t]}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField
            id="coupon-value"
            label={percent ? "Percentage (%)" : "Amount (£)"}
            error={errors?.value}
            hint={percent ? "From 1 to 100. 100 makes the order free." : "Taken off the matching courses, never more than their price."}
          >
            {(aria) => (
              <div className="relative">
                <span aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-slate-500">
                  {percent ? "%" : "£"}
                </span>
                <Input {...aria} name="value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" className="pl-6" />
              </div>
            )}
          </FormField>
        </div>
        <FormField id="coupon-min" label="Minimum spend (£)" error={errors?.minSpend} hint="Optional. Counted on the courses the coupon applies to, before the discount.">
          {(aria) => <Input {...aria} name="minSpend" inputMode="decimal" defaultValue={values?.minSpend ?? (coupon?.minSpend != null ? String(coupon.minSpend) : "")} autoComplete="off" className="max-w-40" />}
        </FormField>
      </Card>

      <Card title="Dates" description="Both are optional, and use your own time zone.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="coupon-starts" label="Starts" error={errors?.startsAtLocal} hint="Refused before this time.">
            {(aria) => <DateTimeInput id={aria.id} name="startsAtLocal" saved={coupon?.startsAt ?? null} submitted={values?.startsAtLocal} error={errors?.startsAtLocal} describedBy={aria["aria-describedby"]} />}
          </FormField>
          <FormField id="coupon-expires" label="Use before" error={errors?.expiresAtLocal} hint="Refused after this time. Must be later than the start.">
            {(aria) => <DateTimeInput id={aria.id} name="expiresAtLocal" saved={coupon?.expiresAt ?? null} submitted={values?.expiresAtLocal} error={errors?.expiresAtLocal} describedBy={aria["aria-describedby"]} />}
          </FormField>
        </div>
        <input
          type="hidden"
          name="timezoneOffset"
          ref={(el) => {
            if (el) el.value = String(new Date().getTimezoneOffset());
          }}
        />
      </Card>

      <Card title="Limits" description="Only uses that are not given back count: an order that fails, is cancelled or expires frees its use.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="coupon-usage" label="Total uses" error={errors?.usageLimit} hint="Optional. Empty means no limit.">
            {(aria) => <Input {...aria} name="usageLimit" inputMode="numeric" defaultValue={values?.usageLimit ?? (coupon?.usageLimit != null ? String(coupon.usageLimit) : "")} autoComplete="off" />}
          </FormField>
          <FormField id="coupon-per-user" label="Uses per learner" error={errors?.perUserLimit} hint="Optional. 1 makes it a once-only coupon.">
            {(aria) => <Input {...aria} name="perUserLimit" inputMode="numeric" defaultValue={values?.perUserLimit ?? (coupon?.perUserLimit != null ? String(coupon.perUserLimit) : "")} autoComplete="off" />}
          </FormField>
        </div>
      </Card>

      <Card
        title="Applies to"
        description="Choose courses and/or categories. A course in the cart qualifies if it is listed or its category is listed. Choose nothing and the coupon applies to every course."
      >
        <CouponPicker
          name="courseIds"
          label="Courses"
          options={courses.map((c) => ({ id: c.id, label: c.title }))}
          initialIds={coupon?.courseIds ?? []}
          noneText="No courses chosen"
          noun={{ one: "course", many: "courses" }}
        />
        <CouponPicker
          name="categoryIds"
          label="Categories"
          options={categories.map((c) => ({ id: c.id, label: c.name }))}
          initialIds={coupon?.categoryIds ?? []}
          noneText="No categories chosen"
          noun={{ one: "category", many: "categories" }}
        />
      </Card>

      {!state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        {!readOnly && (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : mode === "create" ? "Create coupon" : "Save changes"}
          </Button>
        )}
        <Button variant="ghost" render={<Link href="/admin/coupons" />}>
          Back to coupons
        </Button>
      </div>
      </fieldset>
    </form>
  );
}
