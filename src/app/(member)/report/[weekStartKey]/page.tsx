import { notFound } from "next/navigation";
import { PeriodReportView } from "@/components/report/PeriodReportView";
import { WeekNarrative } from "@/components/report/WeekNarrative";
import {
  anchorForWeek,
  buildPeriodReport,
  currentWeekKey,
  loadReportHistory,
  parseReportFocus,
} from "@/lib/report-history";
import { requireUser } from "@/lib/session";
import { getWeeklyProgressReport } from "@/lib/weekly-report";

export default async function PastWeekReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ weekStartKey: string }>;
  searchParams: Promise<{ compare?: string; focus?: string }>;
}) {
  const user = await requireUser();
  const [{ weekStartKey }, query] = await Promise.all([params, searchParams]);
  const history = await loadReportHistory(user.id, new Date(), { weekStartKey, compareKey: query.compare ?? null });
  const model = buildPeriodReport(
    history,
    "week",
    weekStartKey,
    query.compare,
    parseReportFocus(query.focus),
  );
  if (!model) notFound();
  const narrative = await getWeeklyProgressReport(
    user.id,
    anchorForWeek(weekStartKey, history.timeZone, history.now),
  );
  return (
    <PeriodReportView model={model}>
      <WeekNarrative report={narrative} showNextFocus={weekStartKey === currentWeekKey(history.now, history.timeZone)} />
    </PeriodReportView>
  );
}
