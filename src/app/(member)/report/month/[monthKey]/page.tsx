import { MonthReport } from "@/components/report/MonthReport";
import { requireUser } from "@/lib/session";

export default async function PastMonthReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ monthKey: string }>;
  searchParams: Promise<{ compare?: string; focus?: string }>;
}) {
  const user = await requireUser();
  const [{ monthKey }, query] = await Promise.all([params, searchParams]);
  return <MonthReport userId={user.id} monthKey={monthKey} compare={query.compare} focus={query.focus} />;
}
