"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const steps = ["Billing details", "Student details", "Payment details"];

const fieldClassName =
  "w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-3 focus:ring-blue-600/10";
const labelClassName = "mb-2 block text-sm font-medium text-gray-600";
const nextClassName =
  "rounded-lg bg-green-600 px-12 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-green-700";
const backClassName =
  "rounded-lg border border-gray-300 px-8 py-3.5 text-base font-semibold text-gray-600 transition hover:bg-gray-50";

export function CheckoutSteps({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState(0);

  return (
    <>
      <ol className="mx-auto mb-12 flex max-w-3xl items-start justify-between">
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
        <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 lg:col-span-2">
          <h1 className="mb-6 text-2xl font-extrabold text-navy">
            {steps[step]}
          </h1>

          {/* Every step stays mounted so entered values survive going back. */}
          <div hidden={step !== 0}>
            <fieldset className="mb-8 flex flex-wrap gap-6">
              <legend className="sr-only">Customer type</legend>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="radio"
                  name="customerType"
                  defaultChecked
                  className="size-4 accent-blue-600"
                />
                I&apos;m an individual
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="radio"
                  name="customerType"
                  className="size-4 accent-blue-600"
                />
                I&apos;m a business customer
              </label>
            </fieldset>
            <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="billingFirstName" className={labelClassName}>
                  First name
                </label>
                <input
                  id="billingFirstName"
                  autoComplete="given-name"
                  className={fieldClassName}
                />
              </div>
              <div>
                <label htmlFor="billingLastName" className={labelClassName}>
                  Last name
                </label>
                <input
                  id="billingLastName"
                  autoComplete="family-name"
                  className={fieldClassName}
                />
              </div>
            </div>
            <h2 className="mb-4 text-xl font-bold text-navy">Billing address</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="billingHouse" className={labelClassName}>
                  House number or name
                </label>
                <input
                  id="billingHouse"
                  autoComplete="address-line1"
                  className={fieldClassName}
                />
              </div>
              <div>
                <label htmlFor="billingPostcode" className={labelClassName}>
                  Postcode
                </label>
                <input
                  id="billingPostcode"
                  autoComplete="postal-code"
                  className={fieldClassName}
                />
              </div>
            </div>
          </div>

          <div hidden={step !== 1} className="space-y-5">
            <div>
              <label htmlFor="studentName" className={labelClassName}>
                Full name
              </label>
              <input
                id="studentName"
                autoComplete="name"
                placeholder="Enter student full name"
                className={fieldClassName}
              />
            </div>
            <div>
              <label htmlFor="studentEmail" className={labelClassName}>
                Email address
              </label>
              <input
                id="studentEmail"
                type="email"
                autoComplete="email"
                placeholder="student@example.com"
                className={fieldClassName}
              />
            </div>
          </div>

          <div hidden={step !== 2}>
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-gray-600">
              Online payment isn&apos;t available yet. Orders can&apos;t be
              placed until a payment provider is connected.
            </p>
          </div>

          <div className="mt-8 flex justify-between gap-4">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className={backClassName}
              >
                Back
              </button>
            ) : (
              <span />
            )}
            {step < steps.length - 1 && (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className={nextClassName}
              >
                Next
              </button>
            )}
          </div>
        </div>

        <aside>{children}</aside>
      </div>
    </>
  );
}
