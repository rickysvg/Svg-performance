import { OUTSIDE_KIND_OPTIONS, WEEKDAYS } from "@/lib/constants";
import type { OutsideDay } from "@/lib/member-plan";

export function OutsideTrainingFields({ days }: { days: OutsideDay[] }) {
  const byDay = new Map(days.map((day) => [day.weekday, day]));

  return (
    <fieldset>
      <legend className="text-sm font-medium">My gym / class days</legend>
      <p className="mt-1 text-xs text-muted">
        Class / drilling keeps that day light (mobility and easy cardio) and the day before off heavy
        legs and hard intervals. Sparring has no app workout — you log rounds after. Time is optional.
      </p>
      <div className="mt-3 space-y-3">
        {WEEKDAYS.map((day) => {
          const saved = byDay.get(day);
          return (
            <div key={day} className="rounded-xl border border-line px-3 py-3">
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="outsideWeekday"
                  value={day}
                  defaultChecked={Boolean(saved)}
                  className="h-5 w-5 accent-accent"
                />
                {day}
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="block text-xs text-muted">
                  Type
                  <select
                    name={`outsideKind-${day}`}
                    defaultValue={saved?.kind ?? "class"}
                    className="mt-1 w-full rounded-xl border border-line bg-background px-2 py-2 text-sm text-foreground"
                  >
                    {OUTSIDE_KIND_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-muted">
                  Time (optional)
                  <input
                    type="time"
                    name={`outsideTime-${day}`}
                    defaultValue={saved?.time ?? ""}
                    className="mt-1 w-full rounded-xl border border-line bg-background px-2 py-2 text-sm text-foreground"
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
