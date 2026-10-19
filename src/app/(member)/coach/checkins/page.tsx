import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isWeeklyCheckInCoach, listCheckInOverrides, listCheckInsForCoach } from "@/lib/weekly-checkin";
import { CheckInOverrideForm } from "@/components/checkin/CheckInOverrideForm";
import { CoachCheckInList } from "@/components/checkin/CoachCheckInList";

export default async function CoachCheckInsPage() {
  const user = await requireUser();
  if (!isWeeklyCheckInCoach(user)) {
    redirect("/home");
  }
  const [cards, overrides] = await Promise.all([listCheckInsForCoach(), listCheckInOverrides()]);
  const flagged = cards.filter((card) => card.flagCount > 0).length;

  return (
    <main className="relative left-1/2 w-[min(1120px,calc(100vw-2rem))] -translate-x-1/2 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-muted">Coach Ricky</p>
        <h1 className="mt-1 text-4xl">Weekly check-ins</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Flagged athletes first. Read the summary, send the draft, or mark it reviewed.
          About five minutes a client.
        </p>
        <p className="mt-3 text-sm">
          <span className="rounded-full bg-accent px-3 py-1 text-black">{flagged} flagged</span>
          <span className="ml-2 text-muted">{cards.length} in the queue</span>
        </p>
        <p className="mt-3 text-sm">
          <Link href="/admin" className="underline">
            Admin
          </Link>
        </p>
      </div>

      <CheckInOverrideForm enabled={overrides} />

      <CoachCheckInList
        cards={cards.map((card) => ({
          id: card.id,
          name: card.name,
          email: card.email,
          weekKey: card.weekKey,
          submittedLabel: card.submittedAt.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
          bodyweightLb: card.bodyweightLb,
          sleepQuality: card.sleepQuality,
          energy: card.energy,
          stress: card.stress,
          sessionsCompleted: card.sessionsCompleted,
          sessionsPlanned: card.sessionsPlanned,
          sparringSummary: card.sparringSummary,
          wins: card.wins,
          struggles: card.struggles,
          sorenessNotes: card.sorenessNotes,
          regions: card.regions,
          summary: card.summary,
          flags: card.flags,
          tweaks: card.tweaks,
          aiSource: card.aiSource,
          coachStatus: card.coachStatus,
          reply: card.reply,
          hasVideo: card.hasVideo,
        }))}
      />
    </main>
  );
}
