"use client";

import Link from "next/link";
import { useActionState } from "react";
import { deleteSparringLogAction } from "@/app/actions/outside-log";

function SparringLogRow({
  dateKey,
  label,
  detail,
}: {
  dateKey: string;
  label: string;
  detail: string;
}) {
  const [state, action, pending] = useActionState(deleteSparringLogAction, {});

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
        <form action={action}>
          <input type="hidden" name="dateKey" value={dateKey} />
          <button
            type="submit"
            disabled={pending}
            data-sparring-delete={dateKey}
            className="text-xs font-semibold text-[#FF3B3B] disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </form>
      </div>
      {state.error ? (
        <p className="w-full text-sm text-[#FF3B3B]" role="alert">
          {state.error}
        </p>
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
