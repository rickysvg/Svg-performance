import type { getMonthlyWorkoutChallenge } from "@/lib/leaderboard";

export function ChallengeCard({
  challenge,
}: {
  challenge: Awaited<ReturnType<typeof getMonthlyWorkoutChallenge>>;
}) {
  const width = Math.round(challenge.ratio * 100);
  return (
    <section className="overflow-hidden rounded-2xl bg-black px-4 py-5 text-white">
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-xs uppercase tracking-wide text-accent">
          {challenge.title} challenge
        </p>
        <p className="text-xs text-white/70">
          {challenge.daysLeft} day{challenge.daysLeft === 1 ? "" : "s"} left
        </p>
      </div>
      <h2 className="mt-2 text-2xl text-white">{challenge.goal} workouts this month</h2>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-3 text-sm">
        <p className="font-display text-lg uppercase tracking-wide text-accent">
          {challenge.workouts} / {challenge.goal} workouts
        </p>
        <p className="text-xs text-white/70">Scheduled training days count</p>
      </div>
    </section>
  );
}
