"use client";

import { useActionState } from "react";
import { type ContactState, sendContactMessage } from "@/actions/contact";
import { contactSubjects } from "@/lib/contact";

const initialState: ContactState = { status: "idle" };

const fieldClassName =
  "w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-3 focus:ring-blue-600/10";
const labelClassName = "mb-2 block text-sm font-medium text-gray-600";

export function ContactForm() {
  const [state, formAction, pending] = useActionState(
    sendContactMessage,
    initialState,
  );

  if (state.status === "sent") {
    return (
      <p
        role="status"
        className="rounded-lg border border-green-200 bg-green-50 p-5 text-sm font-medium text-green-800"
      >
        Thanks — your message has been sent. We&apos;ll get back to you
        shortly.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className={labelClassName}>
            First Name *
          </label>
          <input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            required
            className={fieldClassName}
          />
        </div>
        <div>
          <label htmlFor="lastName" className={labelClassName}>
            Last Name *
          </label>
          <input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            required
            className={fieldClassName}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className={labelClassName}>
            Email Address *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={fieldClassName}
          />
        </div>
        <div>
          <label htmlFor="phone" className={labelClassName}>
            Phone Number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className={fieldClassName}
          />
        </div>
      </div>
      <div>
        <label htmlFor="subject" className={labelClassName}>
          Subject *
        </label>
        <select id="subject" name="subject" className={fieldClassName}>
          {contactSubjects.map((subject) => (
            <option key={subject}>{subject}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="message" className={labelClassName}>
          Message *
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          minLength={10}
          className={fieldClassName}
        />
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-blue-600 px-10 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
