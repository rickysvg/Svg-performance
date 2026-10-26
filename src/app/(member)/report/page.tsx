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

export default async function WeeklyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ compare?: string; focus?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const history = await loadReportHistory(user.id);
  const key = currentWeekKey(history.now, history.timeZone);
  const model = buildPeriodReport(history, "week", key, query.compare, parseReportFocus(query.focus));
  if (!model) return null;
  const narrative = await getWeeklyProgressReport(
    user.id,
    anchorForWeek(key, history.timeZone, history.now),
  );
  return (
    <PeriodReportView model={model}>
      <WeekNarrative report={narrative} showNextFocus />
    </PeriodReportView>
  );
}
