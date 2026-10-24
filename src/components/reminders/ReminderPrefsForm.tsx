"use client";

import { useActionState, useState } from "react";
import {
  saveReminderPrefsAction,
  type ReminderActionState,
} from "@/app/actions/reminders";
import { StatusBanner } from "@/components/StatusBanner";

export function ReminderPrefsForm({
  prefs,
}: {
  prefs: {
    workoutEnabled: boolean;
    foodEnabled: boolean;
    quoteEnabled: boolean;
    bookingEnabled: boolean;
    preferredHour: number;
    timezoneOffsetMinutes: number;
  };
}) {
  const [state, action, pending] = useActionState(
    saveReminderPrefsAction,
    {} as ReminderActionState,
  );
  const [offset] = useState(() =>
    typeof window === "undefined" ? prefs.timezoneOffsetMinutes : new Date().getTimezoneOffset(),
  );

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-card p-5">
      <h2 className="text-lg">Reminders</h2>
      <p className="text-sm text-muted">
        Home shows a due reminder once per day after your preferred hour. Turn
        any type off anytime.
      </p>
      <StatusBanner error={state.error} success={state.success} />
      <input type="hidden" name="timezoneOffsetMinutes" value={offset} />
      <label className="flex items-center gap-3 text-sm">
        <input
          data-testid="profile-workout-enabled"
          type="checkbox"
          name="workoutEnabled"
          defaultChecked={prefs.workoutEnabled}
          className="h-5 w-5 accent-[#CBF805]"
        />
        Workout log reminder
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input
          data-testid="profile-food-enabled"
          type="checkbox"
          name="foodEnabled"
          defaultChecked={prefs.foodEnabled}
          className="h-5 w-5 accent-[#CBF805]"
        />
        Food log reminder
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input
          data-testid="profile-quote-enabled"
          type="checkbox"
          name="quoteEnabled"
          defaultChecked={prefs.quoteEnabled}
          className="h-5 w-5 accent-[#CBF805]"
        />
        Daily quote reminder
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input
          data-testid="profile-booking-enabled"
          type="checkbox"
          name="bookingEnabled"
          defaultChecked={prefs.bookingEnabled}
          className="h-5 w-5 accent-[#CBF805]"
        />
        Open Book with Ricky request reminder
      </label>
      <label className="block text-sm">
        Preferred local hour (0–23)
        <input
          data-testid="profile-preferred-hour"
          type="number"
          name="preferredHour"
          min={0}
          max={23}
          defaultValue={prefs.preferredHour}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <button
        data-testid="profile-save-reminders"
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save reminders"}
      </button>
    </form>
  );
}
