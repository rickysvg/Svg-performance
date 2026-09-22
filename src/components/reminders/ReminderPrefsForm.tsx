"use client";

import { useActionState, useEffect, useState } from "react";
import {
  saveReminderPrefsAction,
  type ReminderActionState,
} from "@/app/actions/reminders";
import { StatusBanner } from "@/components/StatusBanner";

export function ReminderPrefsForm({
  prefs,
  smtpConfigured,
}: {
  prefs: {
    workoutEnabled: boolean;
    foodEnabled: boolean;
    quoteEnabled: boolean;
    bookingEnabled: boolean;
    preferredHour: number;
    timezoneOffsetMinutes: number;
  };
  smtpConfigured: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveReminderPrefsAction,
    {} as ReminderActionState,
  );
  const [offset, setOffset] = useState(prefs.timezoneOffsetMinutes);

  useEffect(() => {
    setOffset(new Date().getTimezoneOffset());
  }, []);

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-card p-5">
      <h2 className="text-lg font-semibold">Reminders</h2>
      <p className="text-sm text-muted">
        Home shows a due reminder once per day after your preferred hour. Turn
        any type off anytime. True mobile push is later — this preview is in-app
        on Home, plus email if SMTP is set.
      </p>
      <p className="text-xs text-muted">
        {smtpConfigured
          ? "SMTP is configured, so a matching email can go out with the in-app note."
          : "SMTP is not configured. Reminders stay in-app on Home only."}
      </p>
      <StatusBanner error={state.error} success={state.success} />
      <input type="hidden" name="timezoneOffsetMinutes" value={offset} />
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="workoutEnabled"
          defaultChecked={prefs.workoutEnabled}
        />
        Workout log reminder
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="foodEnabled"
          defaultChecked={prefs.foodEnabled}
        />
        Food log reminder
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="quoteEnabled"
          defaultChecked={prefs.quoteEnabled}
        />
        Daily quote reminder (Performance+ / paid catalog)
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="bookingEnabled"
          defaultChecked={prefs.bookingEnabled}
        />
        Open Book with Ricky request reminder
      </label>
      <label className="block text-sm">
        Preferred local hour (0–23)
        <input
          type="number"
          name="preferredHour"
          min={0}
          max={23}
          defaultValue={prefs.preferredHour}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save reminders"}
      </button>
    </form>
  );
}
