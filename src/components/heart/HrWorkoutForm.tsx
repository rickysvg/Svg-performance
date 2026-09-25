"use client";

import { useActionState } from "react";
import { saveWorkoutHrAction, type HeartActionState } from "@/app/actions/heart";
import { StatusBanner } from "@/components/StatusBanner";

function nowInput() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function HrWorkoutForm({
  workoutSessionId,
  defaultStartedAt,
}: {
  workoutSessionId?: string;
  defaultStartedAt?: string;
}) {
  const [state, action, pending] = useActionState(saveWorkoutHrAction, {} as HeartActionState);
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-card p-5">
      <h2>Record workout HR</h2>
      <p className="text-sm text-muted">
        Optional avg / max if no device is connected. Zones are optional seconds.
      </p>
      <StatusBanner error={state.error} success={state.success} />
      {workoutSessionId ? (
        <input type="hidden" name="workoutSessionId" value={workoutSessionId} />
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-2 text-sm">
          <span>Average bpm</span>
          <input
            name="avgBpm"
            type="number"
            min={30}
            max={230}
            required
            className="w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
        <label className="block space-y-2 text-sm">
          <span>Max bpm</span>
          <input
            name="maxBpm"
            type="number"
            min={30}
            max={230}
            required
            className="w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
      </div>
      <label className="block space-y-2 text-sm">
        <span>Started</span>
        <input
          name="startedAt"
          type="datetime-local"
          defaultValue={defaultStartedAt || nowInput()}
          className="w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Ended (optional)</span>
        <input
          name="endedAt"
          type="datetime-local"
          className="w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <fieldset className="grid grid-cols-5 gap-2">
        <legend className="mb-2 text-sm">Zone seconds (optional)</legend>
        {[1, 2, 3, 4, 5].map((zone) => (
          <label key={zone} className="block space-y-1 text-xs">
            <span>Z{zone}</span>
            <input
              name={`zone${zone}Seconds`}
              type="number"
              min={0}
              defaultValue={0}
              className="w-full rounded-lg border border-line bg-background px-2 py-2"
            />
          </label>
        ))}
      </fieldset>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save workout HR"}
      </button>
    </form>
  );
}
