import Link from "next/link";
import { DeltaBadge } from "@/components/report/DeltaBadge";
import { formatTelemetryNumber } from "@/lib/home-telemetry";
import {
  buildWeekArchive,
  formatTrainingTime,
  loadReportHistory,
  type WeekArchiveRow,
} from "@/lib/report-history";
import { requireUser } from "@/lib/session";

function totals(row: WeekArchiveRow) {
  const parts = [`${row.sessions} sess`];
  if (row.trainingLoad > 0) parts.push(formatTelemetryNumber(row.trainingLoad));
  else if (row.trainingSeconds > 0) parts.push(formatTrainingTime(row.trainingSeconds));
  if (row.rounds > 0) parts.push(`${row.rounds} rnd`);
  return parts.join(" · ");
}

export default async function WeekArchivePage() {
  const user = await requireUser();
  const history = await loadReportHistory(user.id);
  const rows = buildWeekArchive(history);
  return (
    <main className="min-w-0 space-y-4" data-week-archive>
      <div>
        <p className="font-display text-xs uppercase tracking-wide text-[#CBF805]">Progress</p>
        <h1 className="mt-1 text-2xl">Weeks</h1>
        <p className="mt-2 text-sm text-muted">
          Monday–Sunday in your time zone, newest first. Lime is up from the week before. Red is down.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No weeks yet.</p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-white/10 bg-black/60">
          {rows.map((row) => {
            return (
              <li key={row.weekStartKey} className="border-b border-white/10 last:border-0">
                <Link
                  href={`/report/${row.weekStartKey}`}
                  className="flex min-h-11 items-center justify-between gap-3 px-3 py-3"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{row.label}</span>
                    <span className="mt-0.5 block text-xs text-muted">{totals(row)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {row.delta ? (
                      <DeltaBadge delta={row.delta} mode={row.deltaMode} />
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                    <span aria-hidden className="text-muted">
                      ›
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-sm">
        <Link href="/report" className="text-[#CBF805] underline">
          This week
        </Link>
        {" · "}
        <Link href="/progress" className="text-[#CBF805] underline">
          Progress
        </Link>
      </p>
    </main>
  );
}
