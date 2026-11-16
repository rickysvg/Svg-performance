"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { captureBrowserFirstTouch } from "@/lib/first-touch";

/**
 * Backup for client navigations. The root layout also runs a beforeInteractive
 * script so the first full page view stores the touch before a link is clicked.
 * Neither path overwrites a touch that is already stored.
 */
export function FirstTouchCapture() {
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search.toString();

  useEffect(() => {
    captureBrowserFirstTouch();
  }, [pathname, query]);

  return null;
}
