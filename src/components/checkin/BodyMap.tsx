"use client";

import { BODY_REGIONS, type BodyRegionId } from "@/lib/weekly-checkin-shared";

const ROWS: BodyRegionId[][] = [
  ["head"],
  ["neck"],
  ["shoulder_l", "shoulder_r"],
  ["chest", "back"],
  ["arm_l", "arm_r"],
  ["wrist_l", "wrist_r"],
  ["hip_l", "hip_r"],
  ["knee_l", "knee_r"],
  ["ankle_l", "ankle_r"],
];

export function BodyMap({
  selected,
  onToggle,
}: {
  selected: BodyRegionId[];
  onToggle: (id: BodyRegionId) => void;
}) {
  const label = new Map(BODY_REGIONS.map((row) => [row.id, row.label]));
  return (
    <fieldset>
      <legend className="text-sm font-semibold">
        Soreness and injuries
        <span className="mt-0.5 block text-xs font-normal text-muted">
          Tap every spot that hurts. Add a note if something is injured.
        </span>
      </legend>
      <div className="mx-auto mt-3 max-w-[18rem] space-y-2 rounded-[1.75rem] border border-line bg-card px-3 py-4">
        <svg viewBox="0 0 80 36" className="mx-auto h-10 w-20 text-foreground" aria-hidden>
          <circle cx="40" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M40 17 v6 M28 26 h24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {ROWS.map((row) => (
          <div key={row.join("-")} className={`grid gap-2 ${row.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {row.map((id) => {
              const on = selected.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(id)}
                  className={`min-h-11 rounded-full border px-2 text-sm ${
                    on ? "border-black bg-accent text-black" : "border-line bg-white"
                  }`}
                >
                  {label.get(id)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <input type="hidden" name="regions" value={selected.join(",")} />
    </fieldset>
  );
}
