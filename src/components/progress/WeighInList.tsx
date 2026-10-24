"use client";

import { useActionState, useState } from "react";
import { updateBodyMetricAction, type BodyMetricActionState } from "@/app/actions/body-metrics";
import { DeleteBodyMetricButton } from "@/components/progress/DeleteBodyMetricButton";
import { formatOneDecimal } from "@/lib/body-metrics";

export function WeighInList({
  rows,
}: {
  rows: Array<{ id: string; label: string; value: number; unit: string }>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [state, action, pending] = useActionState(updateBodyMetricAction, {} as BodyMetricActionState);
  const [closedFor, setClosedFor] = useState<number | undefined>();
  if (state.savedAt && editing && closedFor !== state.savedAt) {
    setClosedFor(state.savedAt);
    setEditing(null);
  }

  if (rows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-line bg-[#0c0e11] px-3 py-3" data-weigh-in-list>
      <h2 className="text-base text-[#f3f4ef]">Weigh-ins</h2>
      <p className="mt-1 text-xs text-[#9aa394]">Change a number or remove the row.</p>
      {state.error ? (
        <p className="mt-2 text-sm text-[#FF3B3B]" role="alert">
          {state.error}
        </p>
      ) : null}
      <ul className="mt-2 divide-y divide-white/10">
        {rows.map((row) => {
          const open = editing === row.id;
          return (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm text-[#f3f4ef]">
              {open ? (
                <form action={action} className="flex min-w-0 flex-1 items-center gap-2">
                  <input type="hidden" name="metricId" value={row.id} />
                  <span className="min-w-0 shrink text-xs text-[#9aa394]">{row.label}</span>
                  <input
                    name="value"
                    inputMode="decimal"
                    required
                    min={1}
                    step="0.1"
                    defaultValue={formatOneDecimal(row.value)}
                    aria-label={`Weight on ${row.label}`}
                    data-weigh-in-edit={row.id}
                    className="w-24 rounded-xl border border-[#CBF805]/50 bg-[#07080a] px-3 py-2 text-[#f3f4ef] caret-[#CBF805] outline-none focus:border-[#CBF805]"
                  />
                  <span className="text-xs text-[#9aa394]">{row.unit}</span>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-full bg-[#CBF805] px-3 py-2 text-xs font-semibold text-black disabled:opacity-60"
                  >
                    {pending ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="text-xs text-[#9aa394]"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span>
                    {row.label}
                    <span className="ml-2 font-semibold text-[#CBF805]">
                      {formatOneDecimal(row.value)} {row.unit}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <button
                      type="button"
                      data-weigh-in-edit-open={row.id}
                      onClick={() => setEditing(row.id)}
                      className="text-xs font-semibold text-[#CBF805]"
                    >
                      Edit
                    </button>
                    <DeleteBodyMetricButton metricId={row.id} testId={`weigh-in-delete-${row.id}`} />
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
