import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getCompanionProgress, summarizeBadges } from "@/lib/progress-companion";
import { getProfileForUser } from "@/lib/profile";
import { getMonthlyWorkoutChallenge, getWorkoutLeaderboard } from "@/lib/leaderboard";
import { StreakHero } from "@/components/progress/StreakHero";
import { BadgesGrid } from "@/components/progress/BadgesGrid";
import { ChallengeCard } from "@/components/progress/ChallengeCard";
import { LeaderboardPodium } from "@/components/progress/LeaderboardPodium";

export default async function StreaksPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const scope = query.scope === "academy" ? "academy" : "all";
  const profile = await getProfileForUser(user.id);
  const units = profile?.preferredUnits ?? "lb";
  const companion = await getCompanionProgress(user.id, units);
  const [challenge, board] = await Promise.all([
    getMonthlyWorkoutChallenge({ userId: user.id, timeZone: companion.timeZone }),
    getWorkoutLeaderboard({
      viewerId: user.id,
      scope,
      timeZone: companion.timeZone,
    }),
  ]);
  const counts = summarizeBadges(companion.badges);

  return (
    <main className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/progress"
          className="touch-target inline-flex items-center justify-center text-2xl leading-none"
          aria-label="Back to Progress"
        >
          ‹
        </Link>
        <h1 className="text-xl">Streaks</h1>
        <span className="w-8" aria-hidden />
      </div>

      <StreakHero streak={companion.streak} />
      <BadgesGrid
        badges={companion.badges}
        earned={counts.earned}
        total={counts.total}
        unit={units}
      />
      <ChallengeCard challenge={challenge} />
      <LeaderboardPodium
        entries={board.entries}
        you={board.you}
        viewerWorkouts={board.viewerWorkouts}
        nextAhead={board.nextAhead}
        optedIn={Boolean(profile?.leaderboardOptIn)}
        scope={scope}
      />
    </main>
  );
}
