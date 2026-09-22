import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getWeeklyProgressReport } from "@/lib/weekly-report";
import { WeeklyWrappedCard } from "@/components/home/WeeklyWrappedCard";

export default async function WeeklyReportPage() {
  const user = await requireUser();
  const report = await getWeeklyProgressReport(user.id);

  return (
    <main className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-accent">{report.labeled}</p>
        <h1 className="text-2xl font-semibold">Weekly SVG progress report</h1>
        <p className="mt-2 text-sm text-muted">{report.copy}</p>
      </div>

      <WeeklyWrappedCard wrap={report.wrap} />

      <section className="space-y-3 rounded-2xl border border-line bg-card p-5">
        <h2 className="font-semibold">Richer than counts</h2>
        <p className="text-sm">
          <span className="text-muted">Strength signal. </span>
          {report.strengthNote}
        </p>
        <p className="text-sm">
          <span className="text-muted">Conditioning. </span>
          {report.conditioningNote}
        </p>
        <p className="text-sm">
          <span className="text-muted">Difficulty trend. </span>
          {report.difficultyLabel}
        </p>
        <p className="text-sm">
          <span className="text-muted">{report.pathTitle}. </span>
          {report.nextFocus}
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-semibold">Coach / Ricky comment</h2>
        {report.showCoachSlot ? (
          report.coachCommentEmpty ? (
            <p className="mt-2 text-sm text-muted">
              Empty until an assigned coach writes something. We do not invent a personal note.
            </p>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm">{report.coachComment}</p>
          )
        ) : (
          <p className="mt-2 text-sm text-muted">
            Personal comments start on Fighter Development.{" "}
            <Link href="/pricing" className="text-accent underline">
              See coaching plans
            </Link>
          </p>
        )}
      </section>

      {report.showEliteAdjustments ? (
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-semibold">Adjustment log</h2>
          <p className="mt-1 text-sm text-muted">Elite+ simple records. Empty until a coach logs one.</p>
          {report.adjustments.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No adjustments yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {report.adjustments.map((row) => (
                <li key={row.id} className="border-t border-line pt-2 first:border-0 first:pt-0">
                  {row.body}
                  <span className="block text-xs text-muted">
                    {row.createdAt.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <p className="text-sm">
        <Link href="/progress" className="text-accent underline">
          Personal records
        </Link>
        {" · "}
        <Link href="/journal" className="text-accent underline">
          Journal
        </Link>
      </p>
    </main>
  );
}
