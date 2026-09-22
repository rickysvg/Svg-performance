"use client";

import { useActionState } from "react";
import { importHeartCsvAction, type HeartActionState } from "@/app/actions/heart";
import { StatusBanner } from "@/components/StatusBanner";

export function HeartImportForm() {
  const [state, action, pending] = useActionState(importHeartCsvAction, {} as HeartActionState);
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-background p-4">
      <h3 className="font-medium">Import Health export / watch workout</h3>
      <p className="text-sm text-muted">
        JSON (Health Auto Export), Apple Health XML, or CSV. Labeled{" "}
        <code>apple_health</code> / <code>apple_watch_import</code>. This is a file you
        exported — not a live Watch pairing.
      </p>
      <StatusBanner error={state.error} success={state.success} />
      <label className="block space-y-2 text-sm">
        <span>File</span>
        <input
          name="file"
          type="file"
          accept=".csv,.json,.xml,text/csv,application/json,text/xml,text/plain"
          className="w-full text-sm"
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Or paste JSON / CSV / XML</span>
        <textarea
          name="csv"
          rows={5}
          className="w-full rounded-xl border border-line bg-card px-3 py-3 font-mono text-xs"
          placeholder={'{"data":{"metrics":[{"name":"resting_heart_rate","data":[{"date":"2026-09-20","qty":58}]}],"workouts":[{"start":"2026-09-20T10:00:00","end":"2026-09-20T10:45:00","avgHeartRate":148,"maxHeartRate":178}]}}'}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Importing…" : "Import Apple Health file"}
      </button>
    </form>
  );
}
