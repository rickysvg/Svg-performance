import { MonthReport } from "@/components/report/MonthReport";
import { requireUser } from "@/lib/session";

export default async function CurrentMonthReportPage({
  searchParams,
}: {
  searchParams: Promise<{ compare?: string; focus?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  return <MonthReport userId={user.id} monthKey={null} compare={query.compare} focus={query.focus} />;
}
