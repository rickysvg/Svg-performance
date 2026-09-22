"use client";

import { useActionState } from "react";
import { importHeartCsvAction, type HeartActionState } from "@/app/actions/heart";
import { StatusBanner } from "@/components/StatusBanner";

export function HeartImportForm() {
  const [state, action, pending] = useActionState(importHeartCsvAction, {} as HeartActionState);
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-card p-5">
      <h2 className="font-semibold">Import Apple Health export / watch workout</h2>
      <p className="text-sm text-muted">
        File or paste. Labeled import. Apple Watch is not connected on the web — this is a
        CSV you exported, not a live pairing.
      </p>
      <StatusBanner error={state.error} success={state.success} />
      <label className="block space-y-2 text-sm">
        <span>CSV file</span>
        <input name="file" type="file" accept=".csv,text/csv,text/plain" className="w-full text-sm" />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Or paste CSV</span>
        <textarea
          name="csv"
          rows={5}
          className="w-full rounded-xl border border-line bg-background px-3 py-3 font-mono text-xs"
          placeholder={"type,recordedAt,bpm\nresting,2026-09-20,58\ntype,startedAt,endedAt,avgBpm,maxBpm,zone1Seconds,zone2Seconds,zone3Seconds,zone4Seconds,zone5Seconds\nworkout,2026-09-20T10:00,2026-09-20T10:45,148,178,300,600,900,400,100"}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full border border-line font-medium disabled:opacity-60"
      >
        {pending ? "Importing…" : "Import CSV"}
      </button>
    </form>
  );
}
