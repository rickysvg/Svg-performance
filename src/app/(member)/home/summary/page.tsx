import { TodaySummaryView } from "@/components/home/TodaySummaryView";
import { loadDaySummaryFacts, templateDaySummary } from "@/lib/coach/day-summary";
import { resolveAiCoach } from "@/lib/coaches";
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
  return (
    <TodaySummaryView
      facts={loaded.facts}
      script={templateDaySummary(loaded.facts)}
      circle={coach.circle}
    />
  );
}
