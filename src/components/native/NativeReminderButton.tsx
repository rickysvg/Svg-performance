"use client";

import { useState } from "react";
import { nativePushRegisterAllowed } from "@/lib/native-push-client";
import { useStoreBillingBlocked } from "@/components/native/useStoreBillingBlocked";

/** Shown in the store app. The tap is what asks for notification permission. */
export function NativeReminderButton() {
  const inApp = useStoreBillingBlocked();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  if (!inApp || !nativePushRegisterAllowed()) return null;
  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        data-native-reminders
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
        onClick={() => {
          setPending(true);
          void import("@/lib/native-push-client")
            .then((mod) => mod.enableNativeReminders())
            .then((result) => setMessage(result.message))
            .finally(() => setPending(false));
        }}
      >
        {pending ? "Asking…" : "Turn on reminders"}
      </button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}
