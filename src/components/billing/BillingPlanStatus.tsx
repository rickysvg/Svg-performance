"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BILLING_CONFIRMING_LABEL } from "@/lib/billing-success";

const MAX_TRIES = 4;
const INTERVAL_MS = 3000;

/**
 * Polls a few times over about 12 seconds. When the subscription lands, the
 * server stops rendering this. After the retries, it drops the checkout query
 * and the page shows the real plan line.
 */
export function BillingPlanStatus({ sessionId }: { sessionId: string }) {
  const router = useRouter();

  useEffect(() => {
    const key = `svg-billing-confirm:${sessionId}`;
    let tries = 0;
    let storageFailed = false;
    try {
      tries = Number(sessionStorage.getItem(key) ?? "0");
    } catch {
      storageFailed = true;
    }
    if (storageFailed || !Number.isFinite(tries) || tries >= MAX_TRIES) {
      router.replace("/billing/success");
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(key, String(tries + 1));
      } catch {
        router.replace("/billing/success");
        return;
      }
      router.refresh();
    }, INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [router, sessionId]);

  return (
    <p className="mt-4 text-sm" data-billing-plan data-billing-confirming="1">
      Your plan: {BILLING_CONFIRMING_LABEL}
    </p>
  );
}
