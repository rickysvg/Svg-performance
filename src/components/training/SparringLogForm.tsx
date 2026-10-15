"use client";

import { useActionState } from "react";
import { saveSparringLogAction, type SparringLogState } from "@/app/actions/outside-log";
import type { SparringLog } from "@/lib/outside-log";

export function SparringLogForm({
  dateKey,
  weekday,
  timeLabel,
  saved,
}: {
  dateKey: string;
  weekday: string;
  timeLabel?: string;
  saved: SparringLog | null;
}) {
  const [state, action, pending] = useActionState(saveSparringLogAction, {} as SparringLogState);

  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <div>
        <p className="font-display text-xs uppercase tracking-wide text-accent">Sparring</p>
        <h3 className="mt-1 text-lg">
          {weekday}
          {timeLabel ? ` · ${timeLabel}` : ""}
        </h3>
        <p className="mt-1 text-sm text-muted">
          No app workout today. Log rounds when you are done. Nothing is saved until you press Save.
        </p>
      </div>
      <input type="hidden" name="dateKey" value={dateKey} />
      <input type="hidden" name="weekday" value={weekday} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Rounds completed
          <input
            name="rounds"
            type="number"
            min={1}
            max={30}
            required
            defaultValue={saved?.rounds ?? ""}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
        <label className="block text-sm">
          Minutes per round
          <input
            name="minutesPerRound"
            type="number"
            min={1}
            max={15}
            required
            defaultValue={saved?.minutesPerRound ?? ""}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
      </div>
      <label className="block text-sm">
        Intensity (optional)
        <select
          name="intensity"
          defaultValue={saved?.intensity ?? ""}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        >
          <option value="">Skip</option>
          <option value="easy">Easy</option>
          <option value="moderate">Moderate</option>
          <option value="hard">Hard</option>
        </select>
      </label>
      <label className="block text-sm">
        Notes (optional)
        <textarea
          name="notes"
          rows={2}
          defaultValue={saved?.notes ?? ""}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      {state.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
      {state.saved ? <p className="text-sm text-accent">Saved.</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent text-black"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
