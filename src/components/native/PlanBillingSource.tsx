"use client";

import { NativeOnly } from "@/components/native/NativeOnly";
import { RestorePurchasesButton } from "@/components/native/NativeProPaywall";

export function storeBillingSourceLabel(store: string | null | undefined) {
  if (store === "app_store") return "Billed by the App Store";
  if (store === "play_store") return "Billed by Google Play";
  if (store === "stripe") return "Billed on the web";
  return "";
}

export function PlanBillingSource({ store }: { store: string | null | undefined }) {
  const label = storeBillingSourceLabel(store);
  return (
    <NativeOnly>
      <div className="mt-3 space-y-3" data-plan-billing-source>
        {label ? <p className="text-sm">{label}</p> : null}
        <RestorePurchasesButton />
      </div>
    </NativeOnly>
  );
}
