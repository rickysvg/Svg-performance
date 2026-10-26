import { notFound } from "next/navigation";
import { PeriodReportView } from "@/components/report/PeriodReportView";
import { getEffectivePlanId } from "@/lib/entitlements";
import { planHasCoachReview } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import {
  buildPeriodReport,
  currentMonthKey,
  formatWeekRange,
  loadReportHistory,
  monthBuckets,
  parseReportFocus,
} from "@/lib/report-history";
import { strengthNoteForPeriod } from "@/lib/weekly-report";
import { zonedCivilToUtc } from "@/lib/timezone";

export async function MonthReport({
  userId,
  monthKey,
  compare,
  focus,
}: {
  userId: string;
  monthKey: string | null;
  compare?: string;
  focus?: string;
}) {
  const history = await loadReportHistory(userId, new Date(), { monthKey, compareKey: compare ?? null });
  const key = monthKey ?? currentMonthKey(history.now, history.timeZone);
  const model = buildPeriodReport(history, "month", key, compare, parseReportFocus(focus));
  if (!model) notFound();
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  const from = zonedCivilToUtc(year, month, 1, history.timeZone);
  const endExclusive = zonedCivilToUtc(
    month === 12 ? year + 1 : year,
    month === 12 ? 1 : month + 1,
    1,
    history.timeZone,
  );
  const [showCoachSlot, strengthNote] = await Promise.all([
    getEffectivePlanId(userId).then((planId) => planHasCoachReview(planId)),
    strengthNoteForPeriod({
      userId,
      from,
      endExclusive,
      displayUnit: history.displayUnit,
      period: "month",
    }),
  ]);
  const buckets = monthBuckets(key, history.timeZone);
  const comments = showCoachSlot
    ? await prisma.weeklyCoachComment.findMany({
        where: { userId, weekStartKey: { in: buckets.map((bucket) => bucket.key) } },
        orderBy: { weekStartKey: "desc" },
      })
    : [];
  return (
    <PeriodReportView model={model}>
      <section className="rounded-2xl border border-white/10 bg-black/50 px-4 py-4">
        <h2>This month</h2>
        <p className="mt-2 text-sm">
          <span className="text-muted">Strength. </span>
          {strengthNote}
        </p>
      </section>
      <section className="rounded-2xl border border-white/10 bg-black/50 px-4 py-4">
        <h2>Coach comments</h2>
        {showCoachSlot ? (
          comments.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              No coach note on the Monday weeks in this month. Empty stays empty.
            </p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {comments.map((comment) => (
                <li key={comment.id} className="border-t border-white/10 pt-3 first:border-0 first:pt-0">
                  <p className="text-xs uppercase tracking-wide text-muted">
                    {formatWeekRange(comment.weekStartKey, history.timeZone)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="mt-2 text-sm text-muted">Personal comments start on VIP Coaching.</p>
        )}
      </section>
    </PeriodReportView>
  );
}
