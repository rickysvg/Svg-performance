"use client";

import { useActionState } from "react";
import { saveReadinessAction, type MobilityActionState } from "@/app/actions/mobility";
import { StatusBanner } from "@/components/StatusBanner";
import { READINESS_CREDITS, readinessSuggestion } from "@/lib/readiness";

export function ReadinessCard({
  dayKey,
  initial,
}: {
  dayKey: string;
  initial: { sleep: number; soreness: number; energy: number; restingHr: number | null } | null;
}) {
  const [state, action, pending] = useActionState(saveReadinessAction, {} as MobilityActionState);
  const suggestion =
    initial != null ? readinessSuggestion(initial) : null;
  return (
    <form action={action} className="space-y-3 rounded-[1.75rem] border border-line bg-card p-5">
      <p className="font-display text-xs uppercase tracking-[0.12em] text-accent">Today</p>
      <h2 className="text-2xl">Readiness</h2>
      <p className="text-sm text-muted">
        Sleep, soreness, and energy from 1 (low) to 5 (ready). A low score suggests an easier day. It does not change the plan.
      </p>
      <StatusBanner error={state.error} success={state.success} />
      {suggestion && !state.success ? (
        <p className="rounded-2xl bg-accent px-3 py-3 text-sm text-black">{suggestion}</p>
      ) : null}
      <input type="hidden" name="dayKey" value={dayKey} />
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["sleep", "Sleep", initial?.sleep],
            ["soreness", "Soreness", initial?.soreness],
            ["energy", "Energy", initial?.energy],
          ] as const
        ).map(([name, label, value]) => (
          <label key={name} className="block text-xs font-medium">
            {label}
            <input
              name={name}
              inputMode="numeric"
              required
              min={1}
              max={5}
              defaultValue={value ?? ""}
              placeholder="1–5"
              className="mt-1 w-full rounded-xl border border-line bg-white px-2 py-3 text-center text-lg"
            />
          </label>
        ))}
      </div>
      <label className="block text-sm font-medium">
        Resting heart rate (optional)
        <input
          name="restingHr"
          inputMode="numeric"
          defaultValue={initial?.restingHr ?? ""}
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-black text-white"
      >
        {pending ? "Saving…" : "Save readiness"}
      </button>
      <p className="text-xs text-muted">
        Inspired by{" "}
        {READINESS_CREDITS.map((credit, index) => (
          <span key={credit.url}>
            {index > 0 ? " and " : ""}
            <a href={credit.url} className="underline" target="_blank" rel="noreferrer">
              {credit.coach}
            </a>
          </span>
        ))}
        . SVG’s check, not their tool.
      </p>
    </form>
  );
}
