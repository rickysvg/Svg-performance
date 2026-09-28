"use client";

import { useActionState } from "react";
import { gymdeskCsvAction, type GymdeskActionState } from "@/app/actions/gymdesk";
import { StatusBanner } from "@/components/StatusBanner";

export function GymdeskCsvPanel() {
  const [state, action, pending] = useActionState(
    gymdeskCsvAction,
    {} as GymdeskActionState,
  );
  const diff = state.diff;

  return (
    <section id="csv" className="space-y-3 rounded-2xl border border-line bg-card p-5">
      <h2 className="text-lg">CSV upload</h2>
      <p className="text-sm text-muted">
        Upload the Gymdesk member-list export (all statuses). We parse it, show a diff, then
        discard the file. Date of birth, address, and notes are never stored.
      </p>
      <form action={action} className="space-y-3">
        <StatusBanner error={state.error} success={state.success} />
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="block w-full text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="intent"
            value="preview"
            disabled={pending}
            className="touch-target rounded-full border border-line px-4 text-sm"
          >
            {pending ? "Working…" : "Preview"}
          </button>
          <button
            type="submit"
            name="intent"
            value="apply"
            disabled={pending}
            className="touch-target rounded-full bg-accent px-4 text-sm text-black"
          >
            Apply roster
          </button>
        </div>
      </form>
      {state.parseErrors && state.parseErrors.length > 0 ? (
        <ul className="list-disc pl-5 text-sm text-danger">
          {state.parseErrors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}
      {diff ? (
        <div className="space-y-3 text-sm">
          <p>
            Incoming rows: <strong>{diff.incoming}</strong>. New IDs: {diff.newIds.length}.
            Status changes: {diff.statusChanges.length}. Unknown status:{" "}
            {diff.unknownStatus.length}. Active in app but missing from this CSV:{" "}
            {diff.missingActive.length}.
          </p>
          {diff.unknownStatus.length > 0 ? (
            <div>
              <p className="font-medium">Unknown status (treated as not active)</p>
              <ul className="mt-1 space-y-1">
                {diff.unknownStatus.map((row) => (
                  <li key={row.gymdeskId}>
                    {row.label} ({row.gymdeskId}) — {row.statusRaw}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {diff.statusChanges.length > 0 ? (
            <div>
              <p className="font-medium">Status changes</p>
              <ul className="mt-1 space-y-1">
                {diff.statusChanges.map((row) => (
                  <li key={row.gymdeskId}>
                    {row.label} {row.from} → {row.to}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {diff.missingActive.length > 0 ? (
            <div>
              <p className="font-medium">Will enter grace (active here, missing in CSV)</p>
              <ul className="mt-1 space-y-1">
                {diff.missingActive.map((row) => (
                  <li key={row.gymdeskId}>{row.label}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
