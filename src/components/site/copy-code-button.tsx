"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type CopyCodeButtonProps = {
  code: string;
  label?: string;
  className?: string;
};

export function CopyCodeButton({
  code,
  label = "Copy",
  className,
}: CopyCodeButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access denied: leave the label unchanged.
    }
  }

  return (
    <button type="button" onClick={copy} className={cn(className)}>
      {copied ? "✓ Copied!" : label}
    </button>
  );
}
