import Link from "next/link";
import type { getWeeklyProgressReport } from "@/lib/weekly-report";

type Narrative = Awaited<ReturnType<typeof getWeeklyProgressReport>>;

export function WeekNarrative({ report, showNextFocus }: { report: Narrative; showNextFocus: boolean }) {
  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-white/10 bg-black/50 px-4 py-4">
        <h2 className="text-lg">This week</h2>
        <p className="mt-2 text-sm text-muted">{report.copy}</p>
        <p className="mt-3 text-sm">
          <span className="text-muted">Strength. </span>
          {report.strengthNote}
        </p>
        <p className="mt-2 text-sm">
          <span className="text-muted">Conditioning. </span>
          {report.conditioningNote}
        </p>
        <p className="mt-2 text-sm">
          <span className="text-muted">Difficulty. </span>
          {report.difficultyLabel}
        </p>
        {report.wrap.mealsLogged > 0 ? (
          <p className="mt-2 text-sm">
            <span className="text-muted">Meals logged. </span>
            {report.wrap.mealsLogged}
          </p>
        ) : null}
        {report.wrap.lessonsCompleted > 0 ? (
          <p className="mt-2 text-sm">
            <span className="text-muted">Lessons completed. </span>
            {report.wrap.lessonsCompleted}
          </p>
        ) : null}
        {showNextFocus ? (
          <p className="mt-2 text-sm">
            <span className="text-muted">{report.pathTitle}. </span>
            {report.nextFocus}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/50 px-4 py-4">
        <h2>Coach comment</h2>
        {report.showCoachSlot ? (
          report.coachCommentEmpty ? (
            <p className="mt-2 text-sm text-muted">
              Empty until an assigned coach writes something for this Monday week. We do not invent a personal note.
            </p>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm">{report.coachComment}</p>
          )
        ) : (
          <p className="mt-2 text-sm text-muted">
            Personal comments start on VIP Coaching.{" "}
            <Link href="/pricing" className="text-[#CBF805] underline">
              See pricing
            </Link>
          </p>
        )}
      </section>

      {report.showEliteAdjustments ? (
        <section className="rounded-2xl border border-white/10 bg-black/50 px-4 py-4">
          <h2>Adjustment log</h2>
          <p className="mt-1 text-sm text-muted">Elite records. Empty until a coach logs one.</p>
          {report.adjustments.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No adjustments yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {report.adjustments.map((row) => (
                <li key={row.id} className="border-t border-white/10 pt-2 first:border-0 first:pt-0">
                  {row.body}
                  <span className="block text-xs text-muted">{row.createdAt.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
