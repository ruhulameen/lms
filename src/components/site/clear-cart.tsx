"use client";

import { useEffect, useRef } from "react";
import { clearCartAfterPayment } from "@/actions/checkout";

// Renders nothing; once the order page shows a paid order it takes the bought
// courses out of the cart cookie (a page cannot write cookies while rendering).
export function ClearCart({ orderNumber }: { orderNumber: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void clearCartAfterPayment(orderNumber);
  }, [orderNumber]);
  return null;
}
