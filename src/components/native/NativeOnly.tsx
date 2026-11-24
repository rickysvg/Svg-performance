"use client";

import type { ReactNode } from "react";
import { useStoreBillingBlocked } from "@/components/native/useStoreBillingBlocked";

/** Store-app-only copy. Absent from the website and from the server render. */
export function NativeOnly({ children }: { children: ReactNode }) {
  const blocked = useStoreBillingBlocked();
  if (!blocked) return null;
  return children;
}
