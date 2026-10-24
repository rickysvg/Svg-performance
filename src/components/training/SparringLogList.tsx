"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { deleteSparringLogAction } from "@/app/actions/outside-log";
import { onSheetBackdropMouseDown, useSheetBehavior } from "@/components/useSheetBehavior";

function SparringLogRow({
  dateKey,
  label,
  detail,
}: {
  dateKey: string;
  label: string;
  detail: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteSparringLogAction, {});
  const panelRef = useSheetBehavior(() => setOpen(false), open);

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 py-3 first:border-0 first:pt-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#f3f4ef]">{label}</p>
        <p className="text-xs text-[#9aa394]">{detail}</p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href={`/sparring?day=${dateKey}`}
          data-sparring-edit={dateKey}
          className="text-xs font-semibold text-[#CBF805]"
        >
          Edit
        </Link>
        <button
          type="button"
          data-sparring-delete={dateKey}
          onClick={() => setOpen(true)}
          className="text-xs font-semibold text-[#FF3B3B]"
        >
          Delete
        </button>
      </div>
      {state.error ? (
        <p className="w-full text-sm text-[#FF3B3B]" role="alert">
          {state.error}
        </p>
      ) : null}
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-6 sm:items-center"
          onMouseDown={(event) => onSheetBackdropMouseDown(event, () => setOpen(false))}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            data-delete-confirm
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0c0e11] px-5 py-5 text-[#f3f4ef] outline-none"
          >
            <p className="font-display text-lg uppercase tracking-wide text-[#FF3B3B]">
              Delete this sparring log?
            </p>
            <p className="mt-2 text-sm text-[#9aa394]">
              This removes the saved log. It can&apos;t be undone.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <form action={action}>
                <input type="hidden" name="dateKey" value={dateKey} />
                <button
                  type="submit"
                  disabled={pending}
                  data-sparring-delete-confirm={dateKey}
                  className="touch-target w-full rounded-full bg-[#FF3B3B] text-base font-semibold text-white disabled:opacity-60"
                >
                  {pending ? "Deleting…" : "Delete"}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="touch-target w-full rounded-full border border-white/15 text-sm text-[#f3f4ef]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function SparringLogList({
  logs,
}: {
  logs: Array<{ dateKey: string; label: string; detail: string }>;
}) {
  return (
    <section
      data-sparring-log-list
      className="rounded-2xl border border-line bg-[#0c0e11] px-4 py-4"
    >
      <h2 className="text-lg text-[#f3f4ef]">Saved logs</h2>
      {logs.length === 0 ? (
        <p className="mt-1 text-sm text-[#9aa394]">No sparring logged yet.</p>
      ) : (
        <ul className="mt-2">
          {logs.map((log) => (
            <SparringLogRow key={log.dateKey} {...log} />
          ))}
        </ul>
      )}
    </section>
  );
}
