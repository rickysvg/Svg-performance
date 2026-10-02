"use client";

import { useActionState, useRef } from "react";
import { saveMobilityLogAction, type MobilityActionState } from "@/app/actions/mobility";
import { StatusBanner } from "@/components/StatusBanner";
import { KICK_MARKS, type MobilityLogRow } from "@/lib/mobility";
import { MobilityFigure } from "@/components/mobility/MobilityFigure";

export type PreviousCell = {
  holdSeconds: number | null;
  reps: number | null;
  sets: number | null;
  depthValue: number | null;
  heightMark: string;
};

function previousText(cell: PreviousCell | undefined, unit: string) {
  if (!cell) return "—";
  const bits = [
    cell.holdSeconds != null ? `${cell.holdSeconds} s` : "",
    cell.reps != null ? `${cell.reps} reps` : "",
    cell.sets != null ? `${cell.sets} sets` : "",
    cell.depthValue != null ? `${cell.depthValue} ${unit}` : "",
    cell.heightMark ? cell.heightMark : "",
  ].filter(Boolean);
  return bits.length > 0 ? bits.join(" · ") : "—";
}

function LogRow({
  row,
  index,
  previous,
  unit,
}: {
  row: MobilityLogRow;
  index: number;
  previous?: PreviousCell;
  unit: string;
}) {
  const holdRef = useRef<HTMLInputElement>(null);
  const repsRef = useRef<HTMLInputElement>(null);
  const setsRef = useRef<HTMLInputElement>(null);
  const depthRef = useRef<HTMLInputElement>(null);
  const heightRef = useRef<HTMLSelectElement>(null);

  function copyLast(checked: boolean) {
    if (!checked || !previous) return;
    if (holdRef.current) holdRef.current.value = previous.holdSeconds?.toString() ?? "";
    if (repsRef.current) repsRef.current.value = previous.reps?.toString() ?? "";
    if (setsRef.current) setsRef.current.value = previous.sets?.toString() ?? "";
    if (depthRef.current) depthRef.current.value = previous.depthValue?.toString() ?? "";
    if (heightRef.current) heightRef.current.value = previous.heightMark ?? "";
  }

  return (
    <fieldset className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start gap-3">
        <MobilityFigure
          blockKey={row.exerciseKey}
          title={row.name}
          mirror={row.side === "right"}
        />
        <div className="min-w-0">
          <p className="px-1 text-base font-semibold">
            {row.name}
            {row.sideLabel ? ` · ${row.sideLabel}` : ""}
          </p>
          <p className="text-xs text-muted">{row.prescription}</p>
        </div>
      </div>
      <p className="text-sm">
        <span className="font-medium">Previous</span>{" "}
        <span className="text-muted">{previousText(previous, unit)}</span>
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-5 w-5 accent-accent"
          disabled={!previous}
          onChange={(event) => copyLast(event.target.checked)}
        />
        Same as last
      </label>
      <input type="hidden" name={`rows.${index}.exerciseKey`} value={row.exerciseKey} />
      <input type="hidden" name={`rows.${index}.side`} value={row.side} />
      <div className="grid grid-cols-3 gap-2">
        <label className="block text-xs font-medium">
          Hold (s)
          <input
            ref={holdRef}
            name={`rows.${index}.holdSeconds`}
            inputMode="numeric"
            defaultValue=""
            className="mt-1 w-full rounded-xl border border-line bg-white px-2 py-3 text-base"
          />
        </label>
        <label className="block text-xs font-medium">
          Reps
          <input
            ref={repsRef}
            name={`rows.${index}.reps`}
            inputMode="numeric"
            defaultValue=""
            className="mt-1 w-full rounded-xl border border-line bg-white px-2 py-3 text-base"
          />
        </label>
        <label className="block text-xs font-medium">
          Sets
          <input
            ref={setsRef}
            name={`rows.${index}.sets`}
            inputMode="numeric"
            defaultValue=""
            className="mt-1 w-full rounded-xl border border-line bg-white px-2 py-3 text-base"
          />
        </label>
      </div>
      {row.track === "depth" ? (
        <label className="block text-xs font-medium">
          Depth / distance ({unit})
          <input
            ref={depthRef}
            name={`rows.${index}.depthValue`}
            inputMode="decimal"
            defaultValue=""
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 text-base"
          />
        </label>
      ) : (
        <input type="hidden" name={`rows.${index}.depthValue`} value="" />
      )}
      {row.track === "height" ? (
        <label className="block text-xs font-medium">
          Height mark
          <select
            ref={heightRef}
            name={`rows.${index}.heightMark`}
            defaultValue=""
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 text-base"
          >
            <option value="">—</option>
            {KICK_MARKS.map((mark) => (
              <option key={mark} value={mark}>
                {mark}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name={`rows.${index}.heightMark`} value="" />
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name={`rows.${index}.pain`} className="h-5 w-5 accent-accent" />
        Pain on this one
      </label>
    </fieldset>
  );
}

export function MobilityLogForm({
  routineId,
  rows,
  previous,
  unit,
}: {
  routineId: string;
  rows: MobilityLogRow[];
  previous: Record<string, PreviousCell>;
  unit: string;
}) {
  const [state, action, pending] = useActionState(saveMobilityLogAction, {} as MobilityActionState);
  return (
    <form action={action} className="space-y-4">
      <StatusBanner error={state.error} success={state.success} />
      <p className="text-sm text-muted">
        Boxes start empty. Previous is the last time you logged this routine. Same as last is optional.
      </p>
      <input type="hidden" name="routineId" value={routineId} />
      <input type="hidden" name="rowCount" value={rows.length} />
      {rows.map((row, index) => (
        <LogRow
          key={`${row.exerciseKey}-${row.side}`}
          row={row}
          index={index}
          previous={previous[`${row.exerciseKey}|${row.side}`]}
          unit={unit}
        />
      ))}
      <label className="block text-sm font-medium">
        Effort 1–5 (optional)
        <input
          name="effort"
          inputMode="numeric"
          defaultValue=""
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3"
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="painFlag" className="h-5 w-5 accent-accent" />
        Pain flag for the session
      </label>
      <p className="text-sm text-muted">
        Sharp pain means stop. Tension is okay. If it keeps happening, see a professional.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent text-base text-black"
      >
        {pending ? "Saving…" : "Save session"}
      </button>
    </form>
  );
}
