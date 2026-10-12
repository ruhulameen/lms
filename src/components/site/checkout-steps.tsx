"use client";

import {
  useActionState,
  useRef,
  useState,
  startTransition,
} from "react";
import { startCheckout, type CheckoutState } from "@/actions/checkout";
import { billingCountries, type BillingFormValues } from "@/lib/checkout";
import { cn } from "@/lib/utils";

const steps = ["Billing details", "Review & pay"];

const fieldClassName =
  "w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-3 focus:ring-blue-600/10";
const labelClassName = "mb-2 block text-sm font-medium text-gray-600";
const nextClassName =
  "rounded-lg bg-green-600 px-12 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-green-700";
const backClassName =
  "rounded-lg border border-gray-300 px-8 py-3.5 text-base font-semibold text-gray-600 transition hover:bg-gray-50";

const initialState: CheckoutState = {};

type CheckoutStepsProps = {
  children: React.ReactNode;
  defaults: BillingFormValues;
  email: string;
  // What the pay button says ("Pay £49", "Complete order").
  payLabel: string;
  // Paid totals need Stripe; false shows "Payments are not set up yet".
  canPay: boolean;
  // A message from the cart that needs the buyer's attention (a coupon that stopped working).
  notice?: string | null;
};

export function CheckoutSteps({
  children,
  defaults,
  email,
  payLabel,
  canPay,
  notice,
}: CheckoutStepsProps) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState(defaults);
  const [state, formAction, pending] = useActionState(
    startCheckout,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  const set = <K extends keyof BillingFormValues>(
    key: K,
    value: BillingFormValues[K],
  ) => setValues((current) => ({ ...current, [key]: value }));
  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0];

  // Billing problems found by the server send the buyer back to that step
  // (adjusted while rendering, once per new result).
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    if (state.fieldErrors && Object.keys(state.fieldErrors).length > 0) setStep(0);
  }

  const next = () => {
    if (formRef.current?.reportValidity()) setStep(1);
  };

  const field = (
    name: keyof BillingFormValues,
    label: string,
    props: React.ComponentProps<"input"> = {},
  ) => (
    <div>
      <label htmlFor={name} className={labelClassName}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        value={values[name]}
        onChange={(e) => set(name, e.target.value as never)}
        aria-invalid={fieldError(name) ? true : undefined}
        className={fieldClassName}
        {...props}
      />
      {fieldError(name) && (
        <p className="mt-1 text-xs text-red-600">{fieldError(name)}</p>
      )}
    </div>
  );

  return (
    <>
      <ol className="mx-auto mb-12 flex max-w-xl items-start justify-between">
        {steps.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className="flex flex-1 items-start"
          >
            {i > 0 && (
              <span
                className={cn(
                  "mx-2 mt-5 hidden h-1 flex-1 rounded-full sm:block",
                  i <= step ? "bg-green-600" : "bg-slate-200",
                )}
              />
            )}
            <span className="flex flex-1 flex-col items-center text-center">
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full text-sm font-bold transition",
                  i <= step
                    ? "bg-green-600 text-white ring-4 ring-green-600/20"
                    : "border-2 border-slate-200 bg-slate-100 text-slate-400",
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  "mt-2 text-xs font-semibold",
                  i <= step ? "text-green-600" : "text-slate-500",
                )}
              >
                {label}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <form
          ref={formRef}
          onSubmit={(e) => {
            // Submitted by hand so React does not clear the fields after the action.
            e.preventDefault();
            if (pending) return;
            if (step === 0) return next();
            const data = new FormData(e.currentTarget);
            startTransition(() => formAction(data));
          }}
          className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 lg:col-span-2"
        >
          <h1 className="mb-6 text-2xl font-extrabold text-navy">
            {steps[step]}
          </h1>

          {notice && (
            <p
              role="status"
              className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            >
              {notice}
            </p>
          )}

          {/* Every step stays mounted so entered values survive going back. */}
          <div hidden={step !== 0}>
            <fieldset className="mb-8 flex flex-wrap gap-6">
              <legend className="sr-only">Customer type</legend>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="radio"
                  name="customerType"
                  value="INDIVIDUAL"
                  checked={values.customerType === "INDIVIDUAL"}
                  onChange={() => set("customerType", "INDIVIDUAL")}
                  className="size-4 accent-blue-600"
                />
                I&apos;m an individual
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="radio"
                  name="customerType"
                  value="BUSINESS"
                  checked={values.customerType === "BUSINESS"}
                  onChange={() => set("customerType", "BUSINESS")}
                  className="size-4 accent-blue-600"
                />
                I&apos;m a business customer
              </label>
            </fieldset>
            <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {field("firstName", "First name", {
                autoComplete: "given-name",
                required: true,
                maxLength: 80,
              })}
              {field("lastName", "Last name", {
                autoComplete: "family-name",
                required: true,
                maxLength: 80,
              })}
              {values.customerType === "BUSINESS" && (
                <div className="sm:col-span-2">
                  {field("company", "Company name", {
                    autoComplete: "organization",
                    required: true,
                    maxLength: 120,
                  })}
                </div>
              )}
            </div>
            <h2 className="mb-4 text-xl font-bold text-navy">
              Billing address
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {field("addressLine1", "House number or name", {
                autoComplete: "address-line1",
                required: true,
                maxLength: 120,
              })}
              {field("addressLine2", "Street / address line 2 (optional)", {
                autoComplete: "address-line2",
                maxLength: 120,
              })}
              {field("city", "Town or city (optional)", {
                autoComplete: "address-level2",
                maxLength: 80,
              })}
              {field("postcode", "Postcode", {
                autoComplete: "postal-code",
                required: true,
                maxLength: 20,
              })}
              <div>
                <label htmlFor="country" className={labelClassName}>
                  Country
                </label>
                <select
                  id="country"
                  name="country"
                  value={values.country}
                  onChange={(e) => set("country", e.target.value)}
                  autoComplete="country"
                  className={fieldClassName}
                >
                  {billingCountries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
                {fieldError("country") && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldError("country")}
                  </p>
                )}
              </div>
              {field("phone", "Phone (optional)", {
                type: "tel",
                autoComplete: "tel",
                maxLength: 40,
              })}
            </div>
          </div>

          <div hidden={step !== 1}>
            <dl className="mb-6 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-gray-500">Billed to</dt>
                <dd className="text-right font-semibold text-gray-800">
                  {values.firstName} {values.lastName}
                  {values.customerType === "BUSINESS" && values.company
                    ? `, ${values.company}`
                    : ""}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-gray-500">Address</dt>
                <dd className="text-right text-gray-800">
                  {[
                    values.addressLine1,
                    values.addressLine2,
                    values.city,
                    values.postcode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-gray-500">Receipt sent to</dt>
                <dd className="text-right text-gray-800">{email}</dd>
              </div>
            </dl>
            {canPay ? (
              <p className="text-sm text-gray-600">
                {payLabel === "Complete order"
                  ? "Nothing to pay. Complete your order to get instant access to your courses."
                  : "You will pay on Stripe's secure page. Card details never touch this site. You get access to your courses as soon as the payment is confirmed."}
              </p>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-gray-600">
                Payments are not set up yet. Orders with something to pay cannot
                be placed until a payment provider is connected.
              </p>
            )}
            {state.error && (
              <p role="alert" className="mt-4 text-sm font-medium text-red-600">
                {state.error}
              </p>
            )}
          </div>

          <div className="mt-8 flex justify-between gap-4">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep(0)}
                className={backClassName}
              >
                Back
              </button>
            ) : (
              <span />
            )}
            {step === 0 ? (
              <button type="button" onClick={next} className={nextClassName}>
                Next
              </button>
            ) : (
              canPay && (
                <button
                  type="submit"
                  disabled={pending}
                  className={cn(nextClassName, "disabled:opacity-60")}
                >
                  {pending ? "Please wait…" : payLabel}
                </button>
              )
            )}
          </div>
        </form>

        <aside>{children}</aside>
      </div>
    </>
  );
}
