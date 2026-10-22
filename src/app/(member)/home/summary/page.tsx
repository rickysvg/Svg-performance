import { TodaySummaryView } from "@/components/home/TodaySummaryView";
import { loadDaySummaryFacts, summaryHeaderWhen, templateDaySummary } from "@/lib/coach/day-summary";
import { resolveAiCoach } from "@/lib/coaches";
import { getAiAllowance } from "@/lib/ai-usage";
import { requireUser } from "@/lib/session";

export default async function TodaySummaryPage() {
  const user = await requireUser();
  const loaded = await loadDaySummaryFacts(user.id).catch(() => null);
  if (!loaded) {
    return (
      <main className="space-y-3" data-today-summary-page>
        <h1 className="text-2xl">Today&apos;s summary</h1>
        <p>I couldn&apos;t load today&apos;s plan. Open Training and do the session that is already written.</p>
      </main>
    );
  }
  const coach = resolveAiCoach(loaded.facts.coachId);
  const allowance = await getAiAllowance(user.id);
  return (
    <TodaySummaryView
      facts={loaded.facts}
      script={templateDaySummary(loaded.facts)}
      circle={coach.circle}
      when={summaryHeaderWhen(loaded.facts.weekday, loaded.dayKey)}
      readAloudsLeft={allowance.readAloudsLeft}
      progress={loaded.progress}
    />
  );
}
