"use client";

import type { ReactNode } from "react";
import { useStoreBillingBlocked } from "@/components/native/useStoreBillingBlocked";

/** Website-only copy. Hidden inside the store apps after hydration. Server HTML matches the website. */
export function WebOnly({ children }: { children: ReactNode }) {
  const blocked = useStoreBillingBlocked();
  if (blocked) return null;
  return children;
}
