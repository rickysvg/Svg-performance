"use client";

import { useState } from "react";

export function ReseedCatalogButton() {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [detail, setDetail] = useState("");

  async function run() {
    setState("working");
    setDetail("");
    try {
      const response = await fetch("/api/admin/reseed-catalog", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as {
        programs?: { daysUpdated?: number }[];
      } | null;
      if (!response.ok) {
        setState("error");
        setDetail("The catalog didn't refresh. Try again.");
        return;
      }
      const updated = (payload?.programs ?? []).reduce(
        (sum, row) => sum + (Number(row.daysUpdated) || 0),
        0,
      );
      setState("done");
      setDetail(
        updated > 0
          ? `${updated} days updated. Logged sessions were left alone.`
          : "Catalog refreshed. Logged sessions were left alone.",
      );
    } catch {
      setState("error");
      setDetail("The catalog didn't refresh. Try again.");
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={state === "working"}
        className="touch-target w-full rounded-full bg-[#CBF805] text-black disabled:opacity-60"
      >
        {state === "working" ? "Refreshing…" : "Reseed exercise catalog"}
      </button>
      {detail ? (
        <p className={`text-sm ${state === "error" ? "text-[#FF3B3B]" : "text-muted"}`}>{detail}</p>
      ) : (
        <p className="text-xs text-muted">Uses the existing catalog refresh. It does not delete logs.</p>
      )}
    </div>
  );
}
