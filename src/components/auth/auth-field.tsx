"use client";

import { useState } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";

type AuthFieldProps = Omit<React.ComponentProps<"input">, "id"> & {
  name: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
};

export function AuthField({
  name,
  label,
  icon: Icon,
  hint,
  type = "text",
  ...props
}: AuthFieldProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-medium text-gray-600"
      >
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
        <input
          id={name}
          name={name}
          type={isPassword && visible ? "text" : type}
          className="w-full rounded-md border border-slate-300 bg-white py-3 pr-10 pl-10 text-sm transition outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-600/10"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            aria-label={visible ? "Hide password" : "Show password"}
            onClick={() => setVisible(!visible)}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-700"
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
