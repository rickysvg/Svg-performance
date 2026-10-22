"use client";

import { useActionState } from "react";
import { saveCheckInPrefsAction, type CheckInActionState } from "@/app/actions/weekly-checkin";
import { StatusBanner } from "@/components/StatusBanner";
import { CHECKIN_WEEKDAYS } from "@/lib/weekly-checkin-shared";

const TIMES = [6, 7, 8, 9, 12, 15, 17, 18, 19, 20, 21];

export function CheckInPrefsForm({
  weekday,
  minuteOfDay,
  timeZone,
}: {
  weekday: number;
  minuteOfDay: number;
  timeZone: string;
}) {
  const [state, action, pending] = useActionState(saveCheckInPrefsAction, {} as CheckInActionState);
  const current = `${weekday}:${minuteOfDay}`;
  return (
    <form data-testid="checkin-form-2" action={action} className="rounded-2xl border border-line bg-card px-4 py-4">
      <StatusBanner error={state.error} success={state.success} />
      <label className="block text-sm font-semibold">
        Reminder day and time
        <span className="mt-0.5 block text-xs font-normal text-muted">{timeZone}</span>
        <select
          data-testid="checkin-when"
          name="when"
          defaultValue={current}
          className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base"
        >
          {CHECKIN_WEEKDAYS.map((day) =>
            TIMES.map((hour) => {
              const minute = hour * 60;
              const labelHour = hour % 12 === 0 ? 12 : hour % 12;
              const suffix = hour >= 12 ? "PM" : "AM";
              return (
                <option key={`${day.value}:${minute}`} value={`${day.value}:${minute}`}>
                  {day.label} {labelHour}:00 {suffix}
                </option>
              );
            }),
          )}
        </select>
      </label>
      <button
        data-testid="checkin-save-reminder-time"
        type="submit"
        disabled={pending}
        className="touch-target mt-3 w-full rounded-full border border-black bg-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save reminder time"}
      </button>
    </form>
  );
}
